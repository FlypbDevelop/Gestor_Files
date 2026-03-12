const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testAPI() {
  console.log('=== Testando API ===\n');
  
  try {
    // Start server (we'll need to do this manually)
    console.log('⚠️  Certifique-se de que o servidor está rodando em http://localhost:3000\n');
    
    // Test 1: Register new user
    console.log('1. Testando registro de novo usuário...');
    const registerData = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'password123'
    };
    
    const registerResponse = await axios.post(`${API_URL}/auth/register`, registerData);
    console.log('   ✓ Registro bem-sucedido');
    console.log(`   Token: ${registerResponse.data.token.substring(0, 20)}...`);
    console.log(`   User: ${registerResponse.data.user.name} (${registerResponse.data.user.email})`);
    console.log(`   Role: ${registerResponse.data.user.role}`);
    console.log(`   Plan ID: ${registerResponse.data.user.plan_id}\n`);
    
    const userToken = registerResponse.data.token;
    
    // Test 2: Login with admin
    console.log('2. Testando login com usuário admin...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    });
    console.log('   ✓ Login bem-sucedido');
    console.log(`   Token: ${loginResponse.data.token.substring(0, 20)}...`);
    console.log(`   User: ${loginResponse.data.user.name} (${loginResponse.data.user.email})`);
    console.log(`   Role: ${loginResponse.data.user.role}\n`);
    
    const adminToken = loginResponse.data.token;
    
    // Test 3: Get current user (authenticated)
    console.log('3. Testando endpoint /auth/me...');
    const meResponse = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.log('   ✓ Endpoint /auth/me funcionando');
    console.log(`   User: ${meResponse.data.user.name}\n`);
    
    // Test 4: Try invalid login
    console.log('4. Testando login com credenciais inválidas...');
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: 'wrong@example.com',
        password: 'wrongpassword'
      });
      console.log('   ✗ Deveria ter falhado!');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('   ✓ Credenciais inválidas rejeitadas corretamente (401)\n');
      } else {
        throw error;
      }
    }
    
    console.log('=== Todos os testes passaram! ===\n');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ Erro: Servidor não está rodando!');
      console.error('   Execute: npm start (em outra janela do terminal)\n');
    } else if (error.response) {
      console.error(`\n❌ Erro na API: ${error.response.status}`);
      console.error(`   ${JSON.stringify(error.response.data, null, 2)}\n`);
    } else {
      console.error('\n❌ Erro:', error.message, '\n');
    }
    process.exit(1);
  }
}

testAPI();
