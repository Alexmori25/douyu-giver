# encoding:utf-8
import os
import base64

def get_secrets(key):
    # 1. 优先尝试获取环境变量 (Secrets)
    # 注意：GitHub Actions 中如果 secrets 不存在，环境变量可能为空字符串或者根本没有
    val = os.environ.get(key)
    if val and val.strip():
        return val
    
    # 2. 如果是 COOKIES 且环境变量没有，尝试读取仓库里的文件
    if key == "COOKIES":
        print("环境变量中未找到 COOKIES，尝试从文件加载...")
        # 尝试多个可能的路径 (兼容 GitHub Action 的工作目录)
        possible_paths = [
            os.path.join(os.getcwd(), ".github", "douyu_cookie.txt"),
            os.path.join(os.getcwd(), "douyu_cookie.txt"), # 兼容旧习惯
        ]
        
        for file_path in possible_paths:
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r') as f:
                        content = f.read().strip()
                        if not content:
                            print(f"警告: 文件 {file_path} 是空的")
                            continue
                            
                        # 脚本上传的是 Base64，所以这里要解码
                        # 注意：如果文件里直接是明文，base64解码会报错，这里做个兼容
                        try:
                            decoded = base64.b64decode(content).decode('utf-8')
                            # 简单脱敏打印，确保读到了东西
                            masked = decoded[:10] + "..." + decoded[-10:] if len(decoded) > 20 else "***"
                            print(f"成功从本地文件加载 COOKIES ({file_path}), 内容预览: {masked}")
                            return decoded
                        except Exception:
                            # 如果解码失败，可能用户手动存的是明文，直接返回
                            print(f"本地文件似乎是明文，直接使用: {file_path}")
                            return content
                except Exception as e:
                    print(f"读取本地 Cookie 文件失败: {e}")
        
        print("未找到有效的 douyu_cookie.txt 文件")
    
    # 3. 都失败了
    if key == "COOKIES":
         print("警告: 无法获取 COOKIES (既无环境变量也无文件)")
    
    return ""
