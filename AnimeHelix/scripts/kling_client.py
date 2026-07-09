import json
import time
import base64
import requests
from typing import Dict, List, Optional
import jwt

class KlingAPI:
    """可灵AI API客户端"""
    
    def __init__(self, api_key: str, base_url: str = "https://api-beijing.klingai.com/v1"):
        """
        初始化可灵API客户端
        
        Args:
            api_key: API密钥
            base_url: API基础URL
        """
        self.api_key = api_key
        self.base_url = base_url
        self.access_key = api_key
        self.secret_key = None  # 需要提供Secret Key来生成JWT
    
    def _get_headers(self) -> Dict:
        """获取请求头"""
        # 直接使用API Key进行认证
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
    
    def image_to_video(
        self,
        image_path: str,
        prompt: str = "",
        model_name: str = "kling-v2-6",
        cfg_scale: float = 0.5,
        mode: str = "pro",
        duration: str = "5",
        aspect_ratio: str = "16:9",
        negative_prompt: str = "",
        image_tail_path: str = None
    ) -> Dict:
        """
        图生视频
        
        Args:
            image_path: 图片路径（首帧）
            prompt: 文本提示词
            model_name: 模型名称
            cfg_scale: 创意度 (0-1)
            mode: 模式 (std/pro)
            duration: 时长 (5/10)
            aspect_ratio: 宽高比 (16:9/9:16/1/4:3/3:4)
            negative_prompt: 反向提示词
            image_tail_path: 尾帧图片路径（可选）
        
        Returns:
            API响应
        """
        # 读取图片并转base64
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode()
        
        url = f"{self.base_url}/videos/image2video"
        payload = {
            "model_name": model_name,
            "image": f"data:image/png;base64,{image_data}",
            "prompt": prompt,
            "cfg_scale": cfg_scale,
            "mode": mode,
            "duration": duration,
            "aspect_ratio": aspect_ratio
        }
        
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        
        # 添加尾帧
        if image_tail_path and os.path.exists(image_tail_path):
            with open(image_tail_path, "rb") as f:
                tail_data = base64.b64encode(f.read()).decode()
            payload["image_tail"] = f"data:image/png;base64,{tail_data}"
        
        response = requests.post(url, headers=self._get_headers(), json=payload)
        return response.json()
    
    def text_to_video(
        self,
        prompt: str,
        model_name: str = "kling-v1",
        cfg_scale: float = 0.5,
        mode: str = "std",
        duration: str = "5",
        aspect_ratio: str = "16:9",
        negative_prompt: str = ""
    ) -> Dict:
        """
        文生视频
        
        Args:
            prompt: 文本提示词
            model_name: 模型名称
            cfg_scale: 创意度 (0-1)
            mode: 模式 (std/pro)
            duration: 时长 (5/10)
            aspect_ratio: 宽高比
            negative_prompt: 反向提示词
        
        Returns:
            API响应
        """
        url = f"{self.base_url}/videos/text2video"
        payload = {
            "model_name": model_name,
            "prompt": prompt,
            "cfg_scale": cfg_scale,
            "mode": mode,
            "duration": duration,
            "aspect_ratio": aspect_ratio
        }
        
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        
        response = requests.post(url, headers=self._get_headers(), json=payload)
        return response.json()
    
    def video_to_video(
        self,
        video_path: str,
        prompt: str = "",
        model_name: str = "kling-v1",
        cfg_scale: float = 0.5,
        mode: str = "std",
        duration: str = "5",
        aspect_ratio: str = "16:9"
    ) -> Dict:
        """
        视频生视频
        
        Args:
            video_path: 视频路径
            prompt: 文本提示词
            model_name: 模型名称
            cfg_scale: 创意度
            mode: 模式
            duration: 时长
            aspect_ratio: 宽高比
        
        Returns:
            API响应
        """
        # 读取视频并转base64
        with open(video_path, "rb") as f:
            video_data = base64.b64encode(f.read()).decode()
        
        url = f"{self.base_url}/videos/video2video"
        payload = {
            "model_name": model_name,
            "video": f"data:video/mp4;base64,{video_data}",
            "prompt": prompt,
            "cfg_scale": cfg_scale,
            "mode": mode,
            "duration": duration,
            "aspect_ratio": aspect_ratio
        }
        
        response = requests.post(url, headers=self._get_headers(), json=payload)
        return response.json()
    
    def query_task(self, task_id: str, task_type: str = "image2video") -> Dict:
        """
        查询任务状态
        
        Args:
            task_id: 任务ID
            task_type: 任务类型 (image2video/text2video/video2video)
        
        Returns:
            任务状态
        """
        url = f"{self.base_url}/videos/{task_type}/{task_id}"
        response = requests.get(url, headers=self._get_headers())
        return response.json()
    
    def wait_for_task(
        self,
        task_id: str,
        task_type: str = "image2video",
        timeout: int = 300,
        poll_interval: int = 3
    ) -> Dict:
        """
        等待任务完成
        
        Args:
            task_id: 任务ID
            task_type: 任务类型
            timeout: 超时时间（秒）
            poll_interval: 轮询间隔（秒）
        
        Returns:
            最终结果
        """
        start_time = time.time()
        
        while True:
            result = self.query_task(task_id, task_type)
            status = result.get("data", {}).get("task_status", "")
            
            if status == "succeed":
                return result
            elif status == "failed":
                return result
            
            if time.time() - start_time > timeout:
                raise TimeoutError(f"任务 {task_id} 超时")
            
            time.sleep(poll_interval)
    
    def download_video(self, video_url: str, output_path: str) -> str:
        """
        下载视频
        
        Args:
            video_url: 视频URL
            output_path: 输出路径
        
        Returns:
            输出路径
        """
        response = requests.get(video_url)
        with open(output_path, "wb") as f:
            f.write(response.content)
        return output_path


# 使用示例
if __name__ == "__main__":
    # 初始化API客户端
    api = KlingAPI("your-api-key")
    
    # 文生视频示例
    result = api.text_to_video(
        prompt="电影级画质，一个红色产品盒子在摄影棚中360度旋转",
        mode="std",
        duration="5"
    )
    print(f"任务已提交: {result}")
    
    # 如果有任务ID，可以查询状态
    if result.get("data", {}).get("task_id"):
        task_id = result["data"]["task_id"]
        final_result = api.wait_for_task(task_id)
        print(f"任务完成: {final_result}")
