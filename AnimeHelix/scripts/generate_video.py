#!/usr/bin/env python3
"""
AnimeHelix 智能视频生成脚本
使用资产管理系统和知识图谱自动生成视频
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.asset_manager import AssetManager

def generate_ecommerce_video():
    """生成电商产品视频"""
    print("=== 生成电商产品视频 ===")
    
    # 初始化资产管理器
    manager = AssetManager("/Users/onetwo/Documents/trae_projects/HelixAgent/AnimeHelix/knowledge")
    
    # 1. 获取模板
    template = manager.get_template("ecommerce_product")
    print(f"使用模板: {template['name']}")
    
    # 2. 获取所需资产
    product = manager.get_asset("props", "prop_001")
    scene = manager.get_asset("scenes", "scene_003")
    style = manager.get_asset("styles", "style_001")
    
    print(f"产品: {product['name']}")
    print(f"场景: {scene['name']}")
    print(f"风格: {style['name']}")
    
    # 3. 生成提示词
    prompt = manager.generate_prompt(
        "ecommerce_product",
        prop={"name": product["name"]},
        scene={"name": scene["name"]},
        style={"keywords": "，".join(style["prompt_keywords"])}
    )
    print(f"\n生成的提示词:\n{prompt}")
    
    # 4. 运行Blender脚本
    print("\n运行Blender脚本...")
    blender_script = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        template["blender_template"]
    )
    os.system(f"/Applications/Blender.app/Contents/MacOS/Blender --background --python {blender_script}")
    
    print("电商产品视频生成完成！")

def generate_drama_video():
    """生成剧情短剧视频"""
    print("=== 生成剧情短剧视频 ===")
    
    # 初始化资产管理器
    manager = AssetManager("/Users/onetwo/Documents/trae_projects/HelixAgent/AnimeHelix/knowledge")
    
    # 1. 获取模板
    template = manager.get_template("drama_dialogue")
    print(f"使用模板: {template['name']}")
    
    # 2. 获取所需资产
    char1 = manager.get_asset("characters", "char_001")
    char2 = manager.get_asset("characters", "char_002")
    scene = manager.get_asset("scenes", "scene_001")
    style = manager.get_asset("styles", "style_001")
    
    print(f"角色1: {char1['name']}")
    print(f"角色2: {char2['name']}")
    print(f"场景: {scene['name']}")
    print(f"风格: {style['name']}")
    
    # 3. 生成提示词
    prompt = manager.generate_prompt(
        "drama_dialogue",
        char1={"name": char1["name"]},
        char2={"name": char2["name"]},
        scene={"name": scene["name"]},
        style={"keywords": "，".join(style["prompt_keywords"])}
    )
    print(f"\n生成的提示词:\n{prompt}")
    
    # 4. 运行Blender脚本
    print("\n运行Blender脚本...")
    blender_script = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        template["blender_template"]
    )
    os.system(f"/Applications/Blender.app/Contents/MacOS/Blender --background --python {blender_script}")
    
    print("剧情短剧视频生成完成！")

def generate_scifi_video():
    """生成科幻视频"""
    print("=== 生成科幻视频 ===")
    
    # 初始化资产管理器
    manager = AssetManager("/Users/onetwo/Documents/trae_projects/HelixAgent/AnimeHelix/knowledge")
    
    # 1. 获取模板
    template = manager.get_template("scifi_action")
    print(f"使用模板: {template['name']}")
    
    # 2. 获取所需资产
    prop = manager.get_asset("props", "prop_002")
    scene = manager.get_asset("scenes", "scene_002")
    style = manager.get_asset("styles", "style_002")
    
    print(f"道具: {prop['name']}")
    print(f"场景: {scene['name']}")
    print(f"风格: {style['name']}")
    
    # 3. 生成提示词
    prompt = manager.generate_prompt(
        "scifi_action",
        prop={"name": prop["name"]},
        scene={"name": scene["name"]},
        style={"keywords": "，".join(style["prompt_keywords"])}
    )
    print(f"\n生成的提示词:\n{prompt}")
    
    # 4. 运行Blender脚本
    print("\n运行Blender脚本...")
    blender_script = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        template["blender_template"]
    )
    os.system(f"/Applications/Blender.app/Contents/MacOS/Blender --background --python {blender_script}")
    
    print("科幻视频生成完成！")

def main():
    """主函数"""
    print("AnimeHelix 智能视频生成系统")
    print("=" * 50)
    print("可用项目类型:")
    print("1. 电商产品视频 (ecommerce)")
    print("2. 剧情短剧视频 (drama)")
    print("3. 科幻视频 (scifi)")
    print("=" * 50)
    
    choice = input("请选择项目类型 (1/2/3): ").strip()
    
    if choice == "1":
        generate_ecommerce_video()
    elif choice == "2":
        generate_drama_video()
    elif choice == "3":
        generate_scifi_video()
    else:
        print("无效选择！")

if __name__ == "__main__":
    main()
