#!/bin/bash

# Admin API 快速测试脚本（带 JWT 认证）
# 使用方法: ./test-admin-api.sh

BASE_URL="http://localhost:8080"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=========================================${NC}"
echo -e "${YELLOW}  Admin API 快速测试脚本（JWT 认证）${NC}"
echo -e "${YELLOW}=========================================${NC}"
echo ""

# 检查服务是否运行
echo -e "${YELLOW}检查服务是否运行...${NC}"
if curl -s "${BASE_URL}/auth/login" -H "Content-Type: application/json" -d '{"username":"test","password":"test"}' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 服务正在运行${NC}"
else
    echo -e "${RED}✗ 服务未运行，请先启动应用: mvn spring-boot:run${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}-----------------------------------------${NC}"
echo -e "${YELLOW}步骤 1: 登录获取 JWT Token${NC}"
echo -e "${YELLOW}-----------------------------------------${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')

if [ "$JWT_TOKEN" = "null" ] || [ -z "$JWT_TOKEN" ] || [ "$JWT_TOKEN" = "" ]; then
    echo -e "${RED}✗ 登录失败！${NC}"
    echo "响应: $LOGIN_RESPONSE"
    echo ""
    echo -e "${YELLOW}请先运行数据库初始化: mysql -u root -p < sql/init.sql${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 登录成功！${NC}"
echo -e "${YELLOW}Token: ${JWT_TOKEN:0:30}...${NC}"
echo ""

# 设置认证头
AUTH_HEADER="Authorization: Bearer ${JWT_TOKEN}"

echo -e "${YELLOW}-----------------------------------------${NC}"
echo -e "${YELLOW}测试 1: 获取用户列表（带认证）${NC}"
echo -e "${YELLOW}-----------------------------------------${NC}"
curl -s -X GET "${BASE_URL}/api/admin/users?page=1&pageSize=10" \
  -H "$AUTH_HEADER" | jq '.'
echo ""

echo -e "${YELLOW}-----------------------------------------${NC}"
echo -e "${YELLOW}测试 2: 创建用户（带认证）${NC}"
echo -e "${YELLOW}-----------------------------------------${NC}"
TIMESTAMP=$(date +%s)
CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/users" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"testuser_${TIMESTAMP}\",
    \"email\": \"test${TIMESTAMP}@example.com\",
    \"password\": \"password123\",
    \"role\": \"USER\",
    \"status\": \"ACTIVE\"
  }")

echo "$CREATE_RESPONSE" | jq '.'
USER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id')
echo -e "${GREEN}创建的用户 ID: ${USER_ID}${NC}"
echo ""

echo -e "${YELLOW}-----------------------------------------${NC}"
echo -e "${YELLOW}测试 3: 更新用户（带认证）${NC}"
echo -e "${YELLOW}-----------------------------------------${NC}"
if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
    curl -s -X PUT "${BASE_URL}/api/admin/users/${USER_ID}" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d '{
        "username": "updated_testuser",
        "email": "updated@example.com"
      }' | jq '.'
else
    echo -e "${RED}跳过：用户 ID 无效${NC}"
fi
echo ""

echo -e "${YELLOW}-----------------------------------------${NC}"
echo -e "${YELLOW}测试 4: 切换用户状态（带认证）${NC}"
echo -e "${YELLOW}-----------------------------------------${NC}"
if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
    curl -s -X PATCH "${BASE_URL}/api/admin/users/${USER_ID}/toggle-status" \
      -H "$AUTH_HEADER" | jq '.'
else
    echo -e "${RED}跳过：用户 ID 无效${NC}"
fi
echo ""

echo -e "${YELLOW}-----------------------------------------${NC}"
echo -e "${YELLOW}测试 5: 删除用户（带认证）${NC}"
echo -e "${YELLOW}-----------------------------------------${NC}"
if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
    curl -s -X DELETE "${BASE_URL}/api/admin/users/${USER_ID}" \
      -H "$AUTH_HEADER" | jq '.'
else
    echo -e "${RED}跳过：用户 ID 无效${NC}"
fi
echo ""

echo -e "${YELLOW}-----------------------------------------${NC}"
echo -e "${YELLOW}测试 6: 错误场景 - 无认证访问（应返回 403）${NC}"
echo -e "${YELLOW}-----------------------------------------${NC}"
curl -s -X GET "${BASE_URL}/api/admin/users?page=1&pageSize=10" | jq '.'
echo ""

echo -e "${YELLOW}-----------------------------------------${NC}"
echo -e "${YELLOW}测试 7: 错误场景 - 用户名重复（409）${NC}"
echo -e "${YELLOW}-----------------------------------------${NC}"
curl -s -X POST "${BASE_URL}/api/admin/users" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "new@example.com",
    "password": "password123",
    "role": "USER",
    "status": "ACTIVE"
  }' | jq '.'
echo ""

echo -e "${YELLOW}-----------------------------------------${NC}"
echo -e "${YELLOW}测试 8: 错误场景 - 参数校验失败（400）${NC}"
echo -e "${YELLOW}-----------------------------------------${NC}"
curl -s -X POST "${BASE_URL}/api/admin/users" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "123",
    "role": "USER",
    "status": "ACTIVE"
  }' | jq '.'
echo ""

echo -e "${YELLOW}=========================================${NC}"
echo -e "${GREEN}  测试完成！${NC}"
echo -e "${YELLOW}=========================================${NC}"
echo ""
echo -e "${YELLOW}详细测试指南请查看: ADMIN_API_TEST_GUIDE.md${NC}"
echo -e "${YELLOW}实现总结请查看: ADMIN_API_IMPLEMENTATION_SUMMARY.md${NC}"
