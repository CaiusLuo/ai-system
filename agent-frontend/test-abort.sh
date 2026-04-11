#!/bin/bash

# Abort 功能测试脚本
# 使用方法: ./test-abort.sh

BASE_URL="http://localhost:8080"
TOKEN="your-test-token"

echo "========================================="
echo "Abort 功能测试脚本"
echo "========================================="
echo ""

# 测试 1: 发起流式请求（需要有效 token）
echo "【测试 1】发起流式聊天请求..."
echo "POST $BASE_URL/agent/chat/stream"
echo ""

# 注意：这个请求需要一个有效的 token 和实际的 Python Agent 服务
# curl -X POST "$BASE_URL/agent/chat/stream" \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer $TOKEN" \
#   -d '{"message": "测试消息", "conversationId": 1}' \
#   -N

echo "跳过：需要有效的认证 token 和 Python Agent 服务"
echo ""

# 测试 2: 测试 abort 接口（无效 messageId）
echo "【测试 2】测试 abort 接口（无效 messageId）..."
echo "POST $BASE_URL/agent/chat/stream/abort"
RESPONSE=$(curl -s -X POST "$BASE_URL/agent/chat/stream/abort" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"messageId": "invalid-id"}')

echo "响应: $RESPONSE"
echo ""

# 测试 3: 测试 abort 接口（空 messageId）
echo "【测试 3】测试 abort 接口（空 messageId）..."
RESPONSE=$(curl -s -X POST "$BASE_URL/agent/chat/stream/abort" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}')

echo "响应: $RESPONSE"
echo ""

# 测试 4: 测试通过 conversationId 中断
echo "【测试 4】测试通过 conversationId 中断..."
echo "POST $BASE_URL/api/v1/chat/1/abort"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/chat/1/abort" \
  -H "Authorization: Bearer $TOKEN")

echo "响应: $RESPONSE"
echo ""

echo "========================================="
echo "测试完成！"
echo "========================================="
echo ""
echo "注意："
echo "1. 需要启动后端服务: mvn spring-boot:run"
echo "2. 需要有效的认证 token"
echo "3. 需要 Python Agent 服务运行"
echo ""
echo "完整测试流程："
echo "1. 启动后端服务"
echo "2. 获取有效 token（通过登录接口）"
echo "3. 发起流式请求，记录 messageId"
echo "4. 调用 abort 接口中断流式生成"
echo "5. 检查日志确认 abort 成功"
