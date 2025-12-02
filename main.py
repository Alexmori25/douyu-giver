# encoding:utf-8
from common.dy_glows import *
from common.login_check import *
from common.config import conf
from common.dy_badge import *
from common.logger import logger
import math
from common.get_secrets import get_secrets
from common.send_message import send_message


def get_send_num(config_val, total_left):
    """
    根据配置计算赠送数量
    :param config_val: 配置的数值（可能是整数、小数或百分比字符串）
    :param total_left: 当前剩余数量
    :return: 实际赠送数量
    """
    s = str(config_val).strip()
    try:
        if s.endswith('%'):
            ratio = float(s[:-1]) / 100
            return int(total_left * ratio)
        
        v = float(s)
        # 如果是0到1之间的小数，视为百分比
        if 0 < v < 1:
            return int(total_left * v)
        # 否则视为具体数量
        return int(v)
    except ValueError:
        logger.warning(f"配置数值格式错误: {config_val}，默认跳过")
        return 0


def run():
    logger.info("------登录检查开始------")
    login_res = is_login()
    logger.info("------登录检查结束------")
    
    mode_conf = conf.get_conf("Modechoose")
    mode = int(mode_conf.get('givemode', 1))
    
    # 获取礼物配置类型
    gift_conf = conf.get_conf("gift")
    gift_type = gift_conf.get('gifttype', 'all') # 默认为all
    
    if login_res:
        # 获取背包所有道具
        all_items = get_glow() or []
        
        # 根据配置筛选礼物
        target_items = []
        if gift_type == 'glow':
            target_items = [x for x in all_items if x.get('id') == 268]
        else:
            # 排除碎片等非礼物道具? 假设id 268是荧光棒，其他也是礼物。
            # 通常背包里会有碎片，这里暂时全部当作礼物处理，如果送不出去 dy_glows 会报错但不会崩溃
            target_items = all_items
            
        if not target_items:
            logger.warning("背包中没有符合条件的礼物 (类型: %s)" % gift_type)
        else:
            logger.info(f"------开始处理礼物赠送 (模式: {mode}, 类型: {gift_type})------")
            
            for item in target_items:
                item_id = item.get('id')
                item_name = item.get('name', '未知礼物')
                item_count = int(item.get('count', 0))
                
                # 忽略数量为0的
                if item_count <= 0:
                    continue
                    
                logger.info(f"正在处理礼物: {item_name} (ID: {item_id}, 数量: {item_count})")
                
                current_left = item_count
                
                try:
            if mode == 1:
                        # 自选模式
                        # logger.info("当前选择模式为:自选模式") # 移到循环外太啰嗦，这里省略
                nums = conf.get_conf_list('selfMode', 'giftCount')
                room_list = conf.get_conf_list('selfMode', 'roomId')
                        
                        for i in range(len(room_list)):
                            if i < len(nums) and current_left > 0:
                                room_id = room_list[i]
                                send_num = get_send_num(nums[i], current_left)
                                
                                if send_num > 0:
                                    # 防止计算出的数量超过剩余（虽然逻辑上应该是剩余的百分比，但如果是固定数值可能超过）
                                    if send_num > current_left:
                                        send_num = current_left
                                        
                                    glow_donate(send_num, room_id, item_id)
                                    current_left -= send_num
                                    
            elif mode == 0:
                        # 平均分配模式
                        # logger.info("当前选择模式为:平均分配模式")
                room_list = get_room_list()
                        if not room_list:
                            logger.warning("未获取到粉丝牌房间列表，跳过分配")
                            continue
                            
                        every_give = math.ceil(item_count / len(room_list))
                        left = int(item_count) - int(every_give) * (len(room_list) - 1)
                        
                        for i, room in enumerate(room_list):
                            if current_left <= 0:
                                break
                                
                            if i == len(room_list) - 1:
                                # 最后一个房间送掉剩下的
                                to_send = current_left
                            else:
                                to_send = every_give
                                
                            if to_send > 0:
                                glow_donate(to_send, room, item_id)
                                current_left -= to_send
                                
                    else:
                        logger.warning("配置错误,没有这种选项")
                        break
                        
                except Exception as e:
                    logger.error(f"赠送礼物 {item_name} 时发生错误: {e}")
                    
            logger.info("------礼物捐赠结束------")
                get_need_exp()

    else:
        logger.warning("未登录状态无法进行后续操作,任务已结束")
        
    try:
        server_key = get_secrets("SERVERPUSHKEY")
        send_message(server_key)
    except Exception as e:
        logger.info("当前未配置Server酱推送，任务结束")
        logger.debug(e)


if __name__ == '__main__':
    run()
