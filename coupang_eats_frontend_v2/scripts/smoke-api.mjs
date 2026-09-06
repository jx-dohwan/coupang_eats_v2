/**
 * FE(Vite proxy) → BE(Nest) 통신 스모크 테스트
 * 전제: Nest :3000, Vite :5173 기동 중
 *
 * 실행: npm run test:smoke
 */
const FE = process.env.SMOKE_FE_BASE ?? 'http://127.0.0.1:5173';
const BE = process.env.SMOKE_BE_BASE ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.SMOKE_EMAIL ?? 'fe-test@example.com';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'Test1234!';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    failed += 1;
  } else {
    console.log(`OK    ${msg}`);
  }
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

async function main() {
  console.log(`BE=${BE}`);
  console.log(`FE=${FE} (proxy → Nest)\n`);

  {
    const { res, body } = await getJson(`${BE}/health`);
    assert(res.ok, `BE GET /health status=${res.status}`);
    assert(body?.success === true && body?.data?.status === 'ok', 'BE /health envelope');
  }

  {
    const { res, body } = await getJson(`${FE}/health`);
    assert(res.ok, `FE proxy GET /health status=${res.status}`);
    assert(body?.success === true && body?.data?.status === 'ok', 'FE proxy /health envelope');
  }

  {
    const { res, body } = await getJson(`${FE}/categories`);
    assert(res.ok, `FE proxy GET /categories status=${res.status}`);
    assert(body?.success === true && Array.isArray(body?.data), 'FE proxy /categories envelope');
  }

  {
    const { res, body } = await getJson(`${FE}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    assert(res.ok, `FE proxy POST /auth/sign-in status=${res.status}`);
    assert(
      body?.success === true && typeof body?.data?.accessToken === 'string' && body.data.accessToken.length > 0,
      'FE proxy /auth/sign-in returns accessToken',
    );
  }

  console.log('');
  if (failed > 0) {
    console.error(`${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('All smoke checks passed');
}

main().catch((err) => {
  console.error('Smoke test crashed:', err.message ?? err);
  process.exit(1);
});
