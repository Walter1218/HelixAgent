#!/usr/bin/env python3
"""
Blender + 可灵 完整工作流
基于可灵API的视频生成方案
"""

import os
import subprocess
import json
import requests
import base64
import time

class BlenderKlingWorkflow:
    """Blender + 可灵工作流"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api-beijing.klingai.com/v1"
    
    def _get_headers(self):
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
    
    def render_blender_frames(self, blender_script: str, output_dir: str):
        """用Blender渲染帧序列"""
        os.makedirs(output_dir, exist_ok=True)
        
        cmd = [
            "/Applications/Blender.app/Contents/MacOS/Blender",
            "--background",
            "--python", blender_script
        ]
        
        print(f"正在渲染Blender帧...")
        subprocess.run(cmd, check=True)
        print(f"渲染完成: {output_dir}")
    
    def extract_key_frames(self, video_path: str, num_frames: int = 5):
        """从视频提取关键帧"""
        output_dir = os.path.join(os.path.dirname(video_path), "keyframes")
        os.makedirs(output_dir, exist_ok=True)
        
        # 获取视频时长
        cmd = f"ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 {video_path}"
        duration = float(subprocess.check_output(cmd, shell=True).decode().strip())
        
        # 均匀提取帧
        for i in range(num_frames):
            timestamp = (duration / num_frames) * i
            output_path = os.path.join(output_dir, f"frame_{i:03d}.png")
            cmd = f"ffmpeg -ss {timestamp} -i {video_path} -vframes 1 {output_path} -y"
            subprocess.run(cmd, shell=True, check=True)
        
        print(f"提取了 {num_frames} 个关键帧到 {output_dir}")
        return output_dir
    
    def kling_text_to_video(self, prompt: str, mode: str = "std", duration: str = "5"):
        """可灵文生视频"""
        url = f"{self.base_url}/videos/text2video"
        payload = {
            "model_name": "kling-v2-6",
            "prompt": prompt,
            "mode": mode,
            "duration": duration
        }
        
        response = requests.post(url, headers=self._get_headers(), json=payload)
        return response.json()
    
    def kling_image_to_video(self, image_path: str, prompt: str, tail_path: str = None, mode: str = "pro"):
        """可灵图生视频"""
        url = f"{self.base_url}/videos/image2video"
        
        # 读取图片并转base64
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode()
        
        payload = {
            "model_name": "kling-v2-6",
            "image": f"data:image/png;base64,{image_data}",
            "prompt": prompt,
            "mode": mode
        }
        
        # 如果有尾帧
        if tail_path and os.path.exists(tail_path):
            with open(tail_path, "rb") as f:
                tail_data = base64.b64encode(f.read()).decode()
            payload["image_tail"] = f"data:image/png;base64,{tail_data}"
        
        response = requests.post(url, headers=self._get_headers(), json=payload)
        return response.json()
    
    def wait_task(self, task_id: str, task_type: str = "image2video", timeout: int = 300):
        """等待任务完成"""
        start_time = time.time()
        
        while True:
            url = f"{self.base_url}/videos/{task_type}/{task_id}"
            response = requests.get(url, headers=self._get_headers())
            result = response.json()
            
            status = result.get("data", {}).get("task_status", "")
            
            if status == "succeed":
                return result
            elif status == "failed":
                return result
            
            if time.time() - start_time > timeout:
                raise TimeoutError(f"任务 {task_id} 超时")
            
            time.sleep(3)
    
    def download_video(self, video_url: str, output_path: str):
        """下载视频"""
        response = requests.get(video_url)
        with open(output_path, "wb") as f:
            f.write(response.content)
        return output_path
    
    def workflow_single_frame(self, blender_script: str, prompt: str):
        """工作流1：单帧增强（Blender首帧 + 可灵图生视频）"""
        print("=== 工作流1：单帧增强 ===")
        
        # 1. Blender渲染
        output_dir = "./output/workflow1"
        self.render_blender_frames(blender_script, output_dir)
        
        # 2. 提取首帧
        first_frame = os.path.join(output_dir, "frame_0001.png")
        
        # 3. 可灵图生视频
        result = self.kling_image_to_video(first_frame, prompt)
        task_id = result["data"]["task_id"]
        print(f"任务已提交: {task_id}")
        
        # 4. 等待完成
        final_result = self.wait_task(task_id)
        video_url = final_result["data"]["task_result"]["videos"][0]["url"]
        
        # 5. 下载
        output_video = os.path.join(output_dir, "enhanced.mp4")
        self.download_video(video_url, output_video)
        print(f"视频已生成: {output_video}")
        
        return output_video
    
    def workflow_multi_frame(self, blender_script: str, prompt: str):
        """工作流2：多帧控制（Blender关键帧 + 可灵首尾帧）"""
        print("=== 工作流2：多帧控制 ===")
        
        # 1. Blender渲染
        output_dir = "./output/workflow2"
        self.render_blender_frames(blender_script, output_dir)
        
        # 2. 提取关键帧
        frames_dir = os.path.join(output_dir, "frames")
        video_file = os.path.join(output_dir, "blender_output.mp4")
        
        # 先用ffmpeg把帧合成视频
        cmd = f"ffmpeg -framerate 30 -i {output_dir}/frame_%04d.png -c:v libx264 {video_file} -y"
        subprocess.run(cmd, shell=True, check=True)
        
        # 提取首帧和尾帧
        first_frame = os.path.join(output_dir, "frame_0001.png")
        last_frame = os.path.join(output_dir, "frame_0120.png")
        
        # 3. 可灵图生视频（带尾帧）
        result = self.kling_image_to_video(first_frame, prompt, last_frame)
        task_id = result["data"]["task_id"]
        print(f"任务已提交: {task_id}")
        
        # 4. 等待完成
        final_result = self.wait_task(task_id)
        video_url = final_result["data"]["task_result"]["videos"][0]["url"]
        
        # 5. 下载
        output_video = os.path.join(output_dir, "enhanced.mp4")
        self.download_video(video_url, output_video)
        print(f"视频已生成: {output_video}")
        
        return output_video
    
    def workflow_segmented(self, blender_scripts: list, prompts: list):
        """工作流3：分段生成（多段Blender + 可灵 + 后期拼接）"""
        print("=== 工作流3：分段生成 ===")
        
        segments = []
        
        for i, (script, prompt) in enumerate(zip(blender_scripts, prompts)):
            print(f"生成第 {i+1} 段...")
            
            # 1. Blender渲染
            output_dir = f"./output/workflow3/segment_{i:02d}"
            self.render_blender_frames(script, output_dir)
            
            # 2. 提取首帧
            first_frame = os.path.join(output_dir, "frame_0001.png")
            
            # 3. 可灵图生视频
            result = self.kling_image_to_video(first_frame, prompt)
            task_id = result["data"]["task_id"]
            
            # 4. 等待完成
            final_result = self.wait_task(task_id)
            video_url = final_result["data"]["task_result"]["videos"][0]["url"]
            
            # 5. 下载
            segment_video = os.path.join(output_dir, "segment.mp4")
            self.download_video(video_url, segment_video)
            segments.append(segment_video)
        
        # 6. 拼接所有段
        concat_file = "./output/workflow3/concat.txt"
        with open(concat_file, "w") as f:
            for seg in segments:
                f.write(f"file '{os.path.abspath(seg)}'\n")
        
        output_video = "./output/workflow3/final.mp4"
        cmd = f"ffmpeg -f concat -safe 0 -i {concat_file} -c copy {output_video} -y"
        subprocess.run(cmd, shell=True, check=True)
        
        print(f"最终视频: {output_video}")
        return output_video


# 使用示例
if __name__ == "__main__":
    # 从配置读取API Key
    import sys
    sys.path.insert(0, 'scripts')
    from config import get_config
    
    config = get_config()
    api_key = config.get_api_key("kling")
    
    # 初始化工作流
    workflow = BlenderKlingWorkflow(api_key)
    
    # 选择工作流
    print("可选工作流：")
    print("1. 单帧增强（简单）")
    print("2. 多帧控制（首尾帧）")
    print("3. 分段生成（多段拼接）")
    
    choice = input("请选择 (1/2/3): ").strip()
    
    if choice == "1":
        workflow.workflow_single_frame(
            blender_script="scripts/blender_product_video.py",
            prompt="电影级画质，产品旋转展示，光影效果华丽"
        )
    elif choice == "2":
        workflow.workflow_multi_frame(
            blender_script="scripts/blender_product_video.py",
            prompt="电影级画质，产品旋转展示，光影效果华丽"
        )
    elif choice == "3":
        workflow.workflow_segmented(
            blender_scripts=["scripts/blender_product_video.py"],
            prompts=["电影级画质，产品旋转展示"]
        )
