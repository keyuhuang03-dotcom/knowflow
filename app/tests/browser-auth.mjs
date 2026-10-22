// Uses only explicitly supplied test credentials. Never reads the personal .env.
export async function authenticate(context, base) {
  const username=process.env.KNOWFLOW_TEST_AUTH_USERNAME, password=process.env.KNOWFLOW_TEST_AUTH_PASSWORD;
  if(!username||!password)throw new Error('Supply KNOWFLOW_TEST_AUTH_USERNAME/PASSWORD for the isolated browser-test server.');
  const result=await context.request.post(base+'/api/auth/login',{headers:{Origin:new URL(base).origin},data:{username,password}});
  if(result.status()!==200)throw new Error('Test-server login failed (HTTP '+result.status()+').');
}
