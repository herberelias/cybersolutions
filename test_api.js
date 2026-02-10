// Using native fetch (Node.js 18+)

// Since we installed dependencies, we might not have node-fetch installed explicitly if not in package.json, 
// but newer node versions have global fetch. Let's assume global fetch or use http module if needed.
// To be safe, let's use the native http module or just use fetch if available. 
// Given the environment, let's try native fetch first.

async function testAPI() {
    const baseUrl = 'http://localhost:3000/api/auth';
    const testUser = {
        nombre: 'Test User ' + Date.now(),
        email: `test${Date.now()}@cybersolutions.com`,
        password: 'password123'
    };

    console.log('--- TESTING REGISTRATION ---');
    try {
        const regRes = await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        const regData = await regRes.json();
        console.log('Status:', regRes.status);
        console.log('Response:', regData);

        if (!regData.success) {
            console.error('Registration failed, stopping test.');
            return;
        }

        console.log('\n--- TESTING LOGIN ---');
        const loginRes = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUser.email, password: testUser.password })
        });
        const loginData = await loginRes.json();
        console.log('Status:', loginRes.status);
        console.log('Response:', loginData);

        if (!loginData.success || !loginData.token) {
            console.error('Login failed, stopping test.');
            return;
        }

        const token = loginData.token;

        console.log('\n--- TESTING PROFILE (PROTECTED) ---');
        const profileRes = await fetch(`${baseUrl}/profile`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const profileData = await profileRes.json();
        console.log('Status:', profileRes.status);
        console.log('Response:', profileData);

    } catch (error) {
        console.error('Error testing API:', error);
    }
}

testAPI();
