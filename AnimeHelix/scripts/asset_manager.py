import json
import os
from typing import Dict, List, Optional

class AssetManager:
    """资产管理器 - 管理素材和知识图谱"""
    
    def __init__(self, knowledge_base_path: str):
        self.knowledge_base_path = knowledge_base_path
        self.graph = self.load_graph()
    
    def load_graph(self) -> Dict:
        """加载知识图谱"""
        graph_path = os.path.join(self.knowledge_base_path, "graph.json")
        with open(graph_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def save_graph(self):
        """保存知识图谱"""
        graph_path = os.path.join(self.knowledge_base_path, "graph.json")
        with open(graph_path, 'w', encoding='utf-8') as f:
            json.dump(self.graph, f, indent=2, ensure_ascii=False)
    
    def get_asset(self, asset_type: str, asset_id: str) -> Optional[Dict]:
        """获取指定类型的资产"""
        return self.graph.get("nodes", {}).get(asset_type, {}).get(asset_id)
    
    def get_all_assets(self, asset_type: str) -> Dict:
        """获取指定类型的所有资产"""
        return self.graph.get("nodes", {}).get(asset_type, {})
    
    def search_assets(self, query: str, asset_type: str = None) -> List[Dict]:
        """根据关键词搜索资产"""
        results = []
        
        for type_name, assets in self.graph.get("nodes", {}).items():
            if asset_type and type_name != asset_type:
                continue
            
            for asset_id, asset in assets.items():
                # 搜索名称、描述、标签
                if (query.lower() in asset.get("name", "").lower() or
                    query.lower() in asset.get("description", "").lower() or
                    any(query.lower() in tag.lower() for tag in asset.get("tags", []))):
                    results.append({
                        "type": type_name,
                        "id": asset_id,
                        **asset
                    })
        
        return results
    
    def get_related_assets(self, asset_id: str, relation_type: str = None) -> List[Dict]:
        """获取与指定资产相关的资产"""
        related = []
        
        for relation in self.graph.get("relations", []):
            if relation["source"] == asset_id or relation["target"] == asset_id:
                if relation_type is None or relation["relation"] == relation_type:
                    # 获取目标资产信息
                    target_type = None
                    for type_name, assets in self.graph.get("nodes", {}).items():
                        if relation["target"] in assets:
                            target_type = type_name
                            break
                    
                    if target_type:
                        related.append({
                            "relation": relation["relation"],
                            "description": relation["description"],
                            "asset": self.get_asset(target_type, relation["target"])
                        })
        
        return related
    
    def get_template(self, template_name: str) -> Optional[Dict]:
        """获取视频模板"""
        return self.graph.get("templates", {}).get(template_name)
    
    def generate_prompt(self, template_name: str, **kwargs) -> str:
        """根据模板生成AI视频提示词"""
        template = self.get_template(template_name)
        if not template:
            return ""
        
        prompt_template = template.get("prompt_template", "")
        
        # 替换模板变量
        prompt = prompt_template
        for key, value in kwargs.items():
            if isinstance(value, dict):
                # 替换 {prop.name} 格式的变量
                for sub_key, sub_value in value.items():
                    prompt = prompt.replace(f"{{{key}.{sub_key}}}", str(sub_value))
            else:
                prompt = prompt.replace(f"{{{key}}}", str(value))
        
        return prompt
    
    def add_asset(self, asset_type: str, asset_id: str, asset_data: Dict):
        """添加新资产"""
        if asset_type not in self.graph.get("nodes", {}):
            self.graph["nodes"][asset_type] = {}
        
        self.graph["nodes"][asset_type][asset_id] = asset_data
        self.save_graph()
    
    def add_relation(self, source_id: str, target_id: str, relation_type: str, description: str = ""):
        """添加新关系"""
        self.graph.get("relations", []).append({
            "source": source_id,
            "target": target_id,
            "relation": relation_type,
            "description": description
        })
        self.save_graph()
    
    def get_project_assets(self, project_type: str) -> Dict:
        """获取特定项目类型所需的所有资产"""
        required = []
        
        # 从模板中获取所需资产
        for template_name, template in self.graph.get("templates", {}).items():
            if project_type in template_name:
                required.extend(template.get("required_assets", []))
        
        # 收集资产信息
        assets = {}
        for asset_ref in required:
            asset_type = asset_ref.split("_")[0] + "s"  # char_001 -> characters
            asset = self.get_asset(asset_type, asset_ref)
            if asset:
                assets[asset_ref] = asset
        
        return assets
    
    def list_templates(self) -> List[Dict]:
        """列出所有可用模板"""
        templates = []
        for name, template in self.graph.get("templates", {}).items():
            templates.append({
                "name": name,
                **template
            })
        return templates


# 使用示例
if __name__ == "__main__":
    # 初始化资产管理器
    manager = AssetManager("/Users/onetwo/Documents/trae_projects/HelixAgent/AnimeHelix/knowledge")
    
    # 搜索资产
    print("=== 搜索红色资产 ===")
    results = manager.search_assets("red")
    for r in results:
        print(f"  {r['type']}/{r['id']}: {r['name']}")
    
    # 获取模板
    print("\n=== 电商产品模板 ===")
    template = manager.get_template("ecommerce_product")
    print(f"  名称: {template['name']}")
    print(f"  描述: {template['description']}")
    print(f"  所需资产: {template['required_assets']}")
    
    # 生成提示词
    print("\n=== 生成提示词 ===")
    prompt = manager.generate_prompt(
        "ecommerce_product",
        prop={"name": "红色产品盒子"},
        scene={"name": "专业摄影棚"},
        style={"keywords": "电影级画质，专业光影"}
    )
    print(f"  提示词: {prompt}")
    
    # 列出所有模板
    print("\n=== 所有模板 ===")
    for t in manager.list_templates():
        print(f"  {t['name']}: {t['description']}")
