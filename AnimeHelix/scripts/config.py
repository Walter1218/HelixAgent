import json
import os
from typing import Dict, Optional

class Config:
    """配置管理器"""
    
    _instance = None
    _config = None
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化配置"""
        if self._config is None:
            self.load_config()
    
    def load_config(self, config_path: str = None):
        """加载配置文件"""
        if config_path is None:
            # 默认配置文件路径
            config_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "config"
            )
            config_path = os.path.join(config_dir, "providers.json")
        
        with open(config_path, 'r', encoding='utf-8') as f:
            self._config = json.load(f)
    
    def get_provider_config(self, provider_name: str) -> Optional[Dict]:
        """获取指定provider的配置"""
        return self._config.get("providers", {}).get(provider_name)
    
    def get_default_config(self) -> Dict:
        """获取默认配置"""
        return self._config.get("defaults", {})
    
    def get_video_settings(self, video_type: str) -> Dict:
        """获取指定视频类型的设置"""
        return self._config.get("video_settings", {}).get(video_type, {})
    
    def update_provider_config(self, provider_name: str, config: Dict):
        """更新provider配置"""
        if "providers" not in self._config:
            self._config["providers"] = {}
        
        self._config["providers"][provider_name] = config
        self.save_config()
    
    def save_config(self, config_path: str = None):
        """保存配置文件"""
        if config_path is None:
            config_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "config"
            )
            config_path = os.path.join(config_dir, "providers.json")
        
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(self._config, f, indent=2, ensure_ascii=False)
    
    def get_api_key(self, provider_name: str) -> Optional[str]:
        """获取指定provider的API密钥"""
        provider = self.get_provider_config(provider_name)
        if provider:
            return provider.get("api_key")
        return None
    
    def is_provider_enabled(self, provider_name: str) -> bool:
        """检查provider是否启用"""
        provider = self.get_provider_config(provider_name)
        if provider:
            return provider.get("enabled", False)
        return False


# 便捷函数
def get_config() -> Config:
    """获取配置实例"""
    return Config()

def get_kling_api_key() -> Optional[str]:
    """获取可灵API密钥"""
    return get_config().get_api_key("kling")

def get_video_settings(video_type: str) -> Dict:
    """获取视频设置"""
    return get_config().get_video_settings(video_type)


# 使用示例
if __name__ == "__main__":
    config = get_config()
    
    # 获取可灵配置
    kling_config = config.get_provider_config("kling")
    print(f"可灵API配置: {kling_config}")
    
    # 获取视频设置
    ecommerce_settings = config.get_video_settings("ecommerce")
    print(f"电商视频设置: {ecommerce_settings}")
    
    # 检查是否启用
    enabled = config.is_provider_enabled("kling")
    print(f"可灵是否启用: {enabled}")
