// Cloudflare Pages Functions: /api/<name> 으로 치지직 API를 중계한다.
// 브라우저는 CORS 때문에 치지직 API를 직접 못 부르므로, 같은 주소의 이 함수가 대신 받아서 넘겨준다.
// 아무 주소나 중계하는 열린 프록시가 되지 않도록 정해진 엔드포인트만 허용한다.

const CH_ID = /^[0-9a-f]{32}$/i;
const CHAT_ID = /^[0-9A-Za-z_-]{1,64}$/;

const ENDPOINTS = {
  // 방송 상태 (chatChannelId 포함)
  'live-status': (q) => CH_ID.test(q.get('ch') || '') && `https://api.chzzk.naver.com/polling/v2/channels/${q.get('ch')}/live-status`,
  // 방송 상세 (채널 이름·이미지·chatChannelId)
  'live-detail': (q) => CH_ID.test(q.get('ch') || '') && `https://api.chzzk.naver.com/service/v3/channels/${q.get('ch')}/live-detail`,
  // 채널 정보 (방송 중이 아닐 때도 이름·이미지)
  'channel': (q) => CH_ID.test(q.get('ch') || '') && `https://api.chzzk.naver.com/service/v1/channels/${q.get('ch')}`,
  // 채팅 접속 토큰
  'token': (q) => CHAT_ID.test(q.get('cid') || '') && `https://comm-api.game.naver.com/nng_main/v1/chats/access-token?channelId=${q.get('cid')}&chatType=STREAMING`,
  // 채널 이름 검색
  'search': (q) => {
    const k = (q.get('q') || '').trim();
    return k && k.length <= 50 && `https://api.chzzk.naver.com/service/v1/search/channels?keyword=${encodeURIComponent(k)}&offset=0&size=10`;
  },
};

const json = (body, status = 200, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra },
});

export async function onRequestGet({ params, request }) {
  const make = ENDPOINTS[params.name];
  const target = make && make(new URL(request.url).searchParams);
  if (!target) return json({ code: 400, message: 'bad request' }, 400);

  let res;
  try {
    res = await fetch(target, {
      headers: {
        // 치지직 API는 브라우저가 아닌 요청을 막는 경우가 있어 일반 브라우저처럼 보낸다
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'application/json',
      },
      cf: { cacheTtl: 0 },
    });
  } catch (e) {
    return json({ code: 502, message: 'upstream fetch failed' }, 502);
  }
  // 방송 상태는 자주 바뀌므로 캐시하지 않는다
  return json(await res.text(), res.status, { 'cache-control': 'no-store' });
}

export function onRequestOptions() {
  return new Response(null, {
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-max-age': '86400' },
  });
}
