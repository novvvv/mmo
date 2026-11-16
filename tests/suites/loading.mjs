// 화면 스크립트를 천천히 불러올 때: client/ 는 여러 파일이 같은 전역을 함께 쓰므로, 파일 사이의 틈에 도는 타이머나
// 그리기가 아직 오지 않은 파일의 값을 쓰면 멈춘다. 파일마다 조금씩 늦게 보내서 그런 틈을 만들고, 오류 없이 들어가는지 본다.
import { enterPage, launchBrowser, loginPage, serverWithAccounts, wait } from '../lib.mjs';

export default async function run(t) {
  const { server, ids } = await serverWithAccounts({ house: [2, 200, 300], town: [0, 820, 620] });
  const browser = await launchBrowser();
  for (const who of ['house', 'town']) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push(e.message));
    let order = 0;
    await page.route('**/*.js', (route) => setTimeout(() => route.continue(), 60 * ++order));   // 뒤 파일일수록 늦게
    await page.goto(server.url);
    await loginPage(page, ids[who]);
    await enterPage(page, { name: who });
    await wait(800);
    t.check(`slowly loaded scripts start without errors (${who})`, problems.length === 0, problems.join(' | '));
    t.check(`and the game draws (${who})`, await page.evaluate(() => typeof me !== 'undefined' && !!me && typeof frame === 'function'));
    await context.close();
  }
  await browser.close();
  await server.stop();
}
