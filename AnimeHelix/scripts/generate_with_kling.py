#!/usr/bin/env python3
"""
AnimeHelix 智能视频生成系统
整合资产管理和可灵API
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from asset_manager import AssetManager
from kling_client import KlingAPI
from config import get_config, get_video_settings

class VideoGenerator:
    """视频生成器"""
    
    def __init__(self):
        """初始化视频生成器"""
        self.config = get_config()
        self.asset_manager = AssetManager(
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "knowledge")
        )
        
        # 初始化可灵API
        api_key = self.config.get_api_key("kling")
        
        if api_key:
            self.kling = KlingAPI(api_key)
        else:
            self.kling = None
            print("警告: 可灵API未配置")
    
    def generate_ecommerce_video(self, product_image: str = None) -> dict:
        """
        生成电商产品视频
        
        Args:
            product_image: 产品图片路径（可选）
        
        Returns:
            生成结果
        """
        print("=== 生成电商产品视频 ===")
        
        # 获取模板和资产
        template = self.asset_manager.get_template("ecommerce_product")
        product = self.asset_manager.get_asset("props", "prop_001")
        scene = self.asset_manager.get_asset("scenes", "scene_003")
        style = self.asset_manager.get_asset("styles", "style_001")
        
        # 获取视频设置
        settings = get_video_settings("ecommerce")
        
        # 生成提示词
        prompt = self.asset_manager.generate_prompt(
            "ecommerce_product",
            prop={"name": product["name"]},
            scene={"name": scene["name"]},
            style={"keywords": "，".join(style["prompt_keywords"])}
        )
        
        print(f"提示词: {prompt}")
        
        # 如果有产品图片，使用图生视频
        if product_image and os.path.exists(product_image):
            print("使用图生视频模式")
            result = self.kling.image_to_video(
                image_path=product_image,
                prompt=prompt,
                mode=settings.get("mode", "std"),
                duration=settings.get("duration", "5"),
                aspect_ratio=settings.get("aspect_ratio", "16:9"),
                cfg_scale=settings.get("cfg_scale", 0.5)
            )
        else:
            # 使用文生视频
            print("使用文生视频模式")
            result = self.kling.text_to_video(
                prompt=prompt,
                mode=settings.get("mode", "std"),
                duration=settings.get("duration", "5"),
                aspect_ratio=settings.get("aspect_ratio", "16:9"),
                cfg_scale=settings.get("cfg_scale", 0.5)
            )
        
        return result
    
    def generate_drama_video(self, scene_description: str = "") -> dict:
        """
        生成剧情短剧视频
        
        Args:
            scene_description: 场景描述（可选）
        
        Returns:
            生成结果
        """
        print("=== 生成剧情短剧视频 ===")
        
        # 获取模板和资产
        template = self.asset_manager.get_template("drama_dialogue")
        char1 = self.asset_manager.get_asset("characters", "char_001")
        char2 = self.asset_manager.get_asset("characters", "char_002")
        scene = self.asset_manager.get_asset("scenes", "scene_001")
        style = self.asset_manager.get_asset("styles", "style_001")
        
        # 获取视频设置
        settings = get_video_settings("drama")
        
        # 生成提示词
        prompt = self.asset_manager.generate_prompt(
            "drama_dialogue",
            char1={"name": char1["name"]},
            char2={"name": char2["name"]},
            scene={"name": scene["name"]},
            style={"keywords": "，".join(style["prompt_keywords"])}
        )
        
        if scene_description:
            prompt = f"{prompt}，{scene_description}"
        
        print(f"提示词: {prompt}")
        
        # 使用文生视频
        result = self.kling.text_to_video(
            prompt=prompt,
            mode=settings.get("mode", "std"),
            duration=settings.get("duration", "15"),
            aspect_ratio=settings.get("aspect_ratio", "16:9"),
            cfg_scale=settings.get("cfg_scale", 0.5)
        )
        
        return result
    
    def generate_scifi_video(self, style_description: str = "") -> dict:
        """
        生成科幻视频
        
        Args:
            style_description: 风格描述（可选）
        
        Returns:
            生成结果
        """
        print("=== 生成科幻视频 ===")
        
        # 获取模板和资产
        template = self.asset_manager.get_template("scifi_action")
        prop = self.asset_manager.get_asset("props", "prop_002")
        scene = self.asset_manager.get_asset("scenes", "scene_002")
        style = self.asset_manager.get_asset("styles", "style_002")
        
        # 获取视频设置
        settings = get_video_settings("scifi")
        
        # 生成提示词
        prompt = self.asset_manager.generate_prompt(
            "scifi_action",
            prop={"name": prop["name"]},
            scene={"name": scene["name"]},
            style={"keywords": "，".join(style["prompt_keywords"])}
        )
        
        if style_description:
            prompt = f"{prompt}，{style_description}"
        
        print(f"提示词: {prompt}")
        
        # 使用文生视频
        result = self.kling.text_to_video(
            prompt=prompt,
            mode=settings.get("mode", "std"),
            duration=settings.get("duration", "10"),
            aspect_ratio=settings.get("aspect_ratio", "16:9"),
            cfg_scale=settings.get("cfg_scale", 0.5)
        )
        
        return result
    
    def generate_custom_video(self, prompt: str, **kwargs) -> dict:
        """
        生成自定义视频
        
        Args:
            prompt: 自定义提示词
            **kwargs: 其他参数
        
        Returns:
            生成结果
        """
        print("=== 生成自定义视频 ===")
        print(f"提示词: {prompt}")
        
        # 合并默认参数
        settings = {
            "mode": "std",
            "duration": "5",
            "aspect_ratio": "16:9",
            "cfg_scale": 0.5
        }
        settings.update(kwargs)
        
        # 使用文生视频
        result = self.kling.text_to_video(
            prompt=prompt,
            mode=settings["mode"],
            duration=settings["duration"],
            aspect_ratio=settings["aspect_ratio"],
            cfg_scale=settings["cfg_scale"]
        )
        
        return result
    
    def wait_and_download(self, result: dict, output_dir: str = None) -> str:
        """
        等待任务完成并下载视频
        
        Args:
            result: API返回的结果
            output_dir: 输出目录
        
        Returns:
            下载的视频路径
        """
        if not result.get("data", {}).get("task_id"):
            print("错误: 没有任务ID")
            return None
        
        task_id = result["data"]["task_id"]
        print(f"等待任务 {task_id} 完成...")
        
        # 等待完成
        final_result = self.kling.wait_for_task(task_id)
        
        if final_result.get("data", {}).get("task_status") == "succeed":
            video_url = final_result["data"]["task_result"]["videos"][0]["url"]
            
            # 设置输出目录
            if output_dir is None:
                output_dir = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "output"
                )
            
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, f"{task_id}.mp4")
            
            # 下载视频
            self.kling.download_video(video_url, output_path)
            print(f"视频已下载: {output_path}")
            
            return output_path
        else:
            print(f"任务失败: {final_result}")
            return None


def main():
    """主函数"""
    print("AnimeHelix 智能视频生成系统")
    print("=" * 50)
    print("可用项目类型:")
    print("1. 电商产品视频 (ecommerce)")
    print("2. 剧情短剧视频 (drama)")
    print("3. 科幻视频 (scifi)")
    print("4. 自定义视频 (custom)")
    print("=" * 50)
    
    choice = input("请选择项目类型 (1/2/3/4): ").strip()
    
    generator = VideoGenerator()
    
    if choice == "1":
        # 电商视频
        product_image = input("请输入产品图片路径（可选，直接回车跳过）: ").strip()
        result = generator.generate_ecommerce_video(product_image or None)
    elif choice == "2":
        # 剧情视频
        scene_desc = input("请输入场景描述（可选）: ").strip()
        result = generator.generate_drama_video(scene_desc)
    elif choice == "3":
        # 科幻视频
        style_desc = input("请输入风格描述（可选）: ").strip()
        result = generator.generate_scifi_video(style_desc)
    elif choice == "4":
        # 自定义视频
        prompt = input("请输入视频提示词: ").strip()
        if not prompt:
            print("错误: 提示词不能为空")
            return
        result = generator.generate_custom_video(prompt)
    else:
        print("无效选择！")
        return
    
    # 等待并下载视频
    if result and result.get("data", {}).get("task_id"):
        video_path = generator.wait_and_download(result)
        if video_path:
            print(f"\n视频生成完成！")
            print(f"文件位置: {video_path}")
    else:
        print(f"API返回: {result}")


if __name__ == "__main__":
    main()
