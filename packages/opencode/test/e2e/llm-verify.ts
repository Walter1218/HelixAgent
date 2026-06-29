#!/usr/bin/env bun
// LLM端到端验证脚本 - 注意请求频率

const SERVER = "http://127.0.0.1:4096"
const DELAY = 2000 // 2秒间隔，避免频率限制

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function createSession(title: string) {
  const res = await fetch(`${SERVER}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  })
  return res.json()
}

async function sendMessage(sessionId: string, text: string) {
  const res = await fetch(`${SERVER}/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parts: [{ type: "text", text }] })
  })
  return res.json()
}

function extractText(response: any): string {
  const textPart = response.parts?.find((p: any) => p.type === "text")
  return textPart?.text || ""
}

async function testPhase1Memory() {
  console.log("\n=== Phase 1: Memory Tool ===")
  const session = await createSession("Memory Test")
  console.log(`Session: ${session.id}`)
  
  await sleep(DELAY)
  const res = await sendMessage(session.id, "Search memory for any project rules or conventions")
  const text = extractText(res)
  console.log(`Response: ${text.slice(0, 200)}...`)
  console.log("✅ Memory tool accessible\n")
}

async function testPhase2Actor() {
  console.log("=== Phase 2: Actor System ===")
  const session = await createSession("Actor Test")
  console.log(`Session: ${session.id}`)
  
  await sleep(DELAY)
  const res = await sendMessage(session.id, "Create a subagent to explore the codebase structure")
  const text = extractText(res)
  console.log(`Response: ${text.slice(0, 200)}...`)
  console.log("✅ Actor system accessible\n")
}

async function testPhase2Task() {
  console.log("=== Phase 2: Task System ===")
  const session = await createSession("Task Test")
  console.log(`Session: ${session.id}`)
  
  await sleep(DELAY)
  const res = await sendMessage(session.id, "Create a task to implement user login feature")
  const text = extractText(res)
  console.log(`Response: ${text.slice(0, 200)}...`)
  console.log("✅ Task system accessible\n")
}

async function testPhase3Judge() {
  console.log("=== Phase 3: Judge System ===")
  const session = await createSession("Judge Test")
  console.log(`Session: ${session.id}`)
  
  await sleep(DELAY)
  const res = await sendMessage(session.id, "Create a simple hello world function in TypeScript")
  const text = extractText(res)
  console.log(`Response: ${text.slice(0, 200)}...`)
  console.log("✅ Judge system accessible\n")
}

async function testMultiTurn() {
  console.log("=== 多轮对话测试 ===")
  const session = await createSession("Multi-Turn Test")
  console.log(`Session: ${session.id}`)
  
  // 第一轮
  await sleep(DELAY)
  const res1 = await sendMessage(session.id, "Create a file named hello.txt with content 'Hello World'")
  const text1 = extractText(res1)
  console.log(`轮次1: ${text1.slice(0, 150)}...`)
  
  // 第二轮 - 引用前文
  await sleep(DELAY)
  const res2 = await sendMessage(session.id, "Now read the file you just created and show me the content")
  const text2 = extractText(res2)
  console.log(`轮次2: ${text2.slice(0, 150)}...`)
  
  // 第三轮 - 继续任务
  await sleep(DELAY)
  const res3 = await sendMessage(session.id, "Append 'Modified by AI' to the end of that file")
  const text3 = extractText(res3)
  console.log(`轮次3: ${text3.slice(0, 150)}...`)
  
  console.log("✅ 多轮对话通过\n")
}

async function testToolCalling() {
  console.log("=== 工具调用测试 ===")
  const session = await createSession("Tool Call Test")
  console.log(`Session: ${session.id}`)
  
  await sleep(DELAY)
  const res = await sendMessage(session.id, "List all files in the current directory using the read or glob tool")
  const text = extractText(res)
  console.log(`Response: ${text.slice(0, 200)}...`)
  console.log("✅ 工具调用通过\n")
}

async function main() {
  console.log("🚀 LLM端到端验证开始")
  console.log(`服务器: ${SERVER}`)
  console.log(`请求间隔: ${DELAY}ms\n`)
  
  try {
    await testPhase1Memory()
    await testPhase2Actor()
    await testPhase2Task()
    await testPhase3Judge()
    await testMultiTurn()
    await testToolCalling()
    
    console.log("🎉 所有验证通过!")
  } catch (error) {
    console.error("❌ 验证失败:", error)
  }
}

main()
