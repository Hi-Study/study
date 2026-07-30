// 기획 스터디 앱 — 내가 참여한 스터디들. 각 스터디는 공유 글(달력)과 주차별 토론을 가진다.
(function () {
  const baseComments = (topic) => ([
    { id: 1, author: "한독자", role: "Junior PM", time: "2시간 전", up: 14, text: "저는 초기엔 프로토타입을 먼저 만들어 보여줍니다. 숫자보다 '작동하는 화면'이 더 설득력 있더라고요.",
      replies: [
        { id: 11, author: "정문서", role: "PM Lead", time: "1시간 전", text: "동의해요. 다만 프로토타입도 '왜 이렇게 만들었는지' 근거가 없으면 취향 싸움이 되더라고요.", quote: "숫자보다 '작동하는 화면'이 더 설득력 있더라고요." },
      ] },
    { id: 2, author: "서비스기획", role: "Service Planner", time: "1시간 전", up: 9, text: "경쟁사 벤치마크를 정성적 근거로 자주 씁니다. 다만 남용하면 '카피' 소리 들어서 조심하고 있어요.", replies: [] },
    { id: 3, author: "김기획", role: "PO", time: "48분 전", up: 21, text: "문장으로 먼저 설득하고, 숫자로 확인시킨다 — 이 순서를 지키려 합니다.", replies: [] },
  ]);

  window.STUDY_DATA = {
    // 내가 참여한 스터디 목록
    studies: [
      {
        id: "s1", name: "기획 뜯어보기", desc: "매주 기획 아티클을 읽고 토론하는 모임", members: 14, code: "K7F2QX", role: "방장", week: "7월 셋째 주",
        memberList: [{ name: "김기획", role: "PO" }, { name: "이지표", role: "Data PM" }, { name: "박리서치", role: "UX Researcher" }, { name: "정문서", role: "PM Lead" }, { name: "최회고", role: "Product Coach" }, { name: "한독자", role: "Junior PM" }, { name: "서비스기획", role: "Service Planner" }],
        shares: [
          { id: 1, day: "mon", title: "좋은 기획서의 조건", source: "brunch.co.kr", url: "https://brunch.co.kr/@example/1", sharedBy: "김기획", role: "PO", note: "'무엇을 뺄까'라는 관점이 정말 좋았어요.", likes: 24, comments: 5 },
          { id: 2, day: "mon", title: "PM이 놓치기 쉬운 문서의 함정", source: "medium.com", url: "https://medium.com/@example/1", sharedBy: "정문서", role: "PM Lead", note: "원페이저 파트 강추.", likes: 11, comments: 2 },
          { id: 3, day: "tue", title: "데이터로 말하기: 대시보드의 함정", source: "yozm.wishket.com", url: "https://yozm.wishket.com/magazine/1", sharedBy: "이지표", role: "Data PM", note: "질문을 먼저 쓰라는 조언이 실용적.", likes: 18, comments: 4 },
          { id: 4, day: "wed", title: "인터뷰에서 진짜를 듣는 법", source: "eopla.net", url: "https://eopla.net/magazine/1", sharedBy: "박리서치", role: "UX Researcher", note: "과거 행동을 묻는 질문법, 바로 써먹었습니다.", likes: 31, comments: 7 },
          { id: 5, day: "wed", title: "사용자는 자신을 모른다", source: "nngroup.com", url: "https://www.nngroup.com/articles/example/", sharedBy: "한독자", role: "Junior PM", note: "고전이지만 다시 봐도 좋네요.", likes: 9, comments: 1 },
          { id: 6, day: "thu", title: "한 장으로 끝내는 제안서", source: "toss.tech", url: "https://toss.tech/article/example", sharedBy: "정문서", role: "PM Lead", note: "압축의 예술.", likes: 15, comments: 3 },
          { id: 7, day: "fri", title: "실패한 기획에서 배우기", source: "ppss.kr", url: "https://ppss.kr/archives/example", sharedBy: "최회고", role: "Product Coach", note: "회고를 시스템 관점으로 보게 됨.", likes: 13, comments: 2 },
          { id: 8, day: "fri", title: "회고 잘하는 팀의 5가지 습관", source: "blog.gaerae.com", url: "https://blog.gaerae.com/example", sharedBy: "서비스기획", role: "Service Planner", note: "우리 스터디에도 적용해봐요.", likes: 7, comments: 0 },
          { id: 9, day: "thu", type: "text", title: "이번 주 읽은 글 정리 (직접 작성)", sharedBy: "김기획", role: "PO", likes: 5, comments: 1,
            body: ["이번 주 공유된 글들을 제 관점에서 정리해봤어요.", "핵심은 '문장이 먼저, 숫자는 확인용'이라는 것. 세 편 모두 이 결을 공유하더군요.", "다음 주엔 실제 제안서에 적용한 사례를 가져와볼게요."] },
        ],
        discussions: [
          { id: "d1", week: "7월 셋째 주", title: "숫자 없이도 설득되는 기획서, 가능할까?", prompt: "정량 데이터가 부족한 초기 아이디어를 어떻게 설득력 있게 제안할 수 있을까요?", count: 12, active: true,
            body: ["이번 주 함께 읽은 글의 공통점은 '문장이 먼저'라는 관점이었습니다.", "하지만 실무에선 숫자를 요구하는 조직도 많죠. 정량 근거가 약할 때 어떻게 설득하시나요?", "정성적 스토리, 벤치마크, 프로토타입 — 각자의 무기를 나눠봅시다."],
            comments: baseComments() },
          { id: "d2", week: "7월 둘째 주", title: "좋은 PRD의 최소 요건은?", prompt: "꼭 들어가야 하는 항목과 빼도 되는 항목을 나눠봅시다.", count: 9, active: false,
            body: ["PRD는 길수록 안 읽힙니다. 그렇다면 최소 요건은 무엇일까요?", "문제 정의 / 목표 지표 / 범위 — 이 셋만 있으면 될까요?"],
            comments: baseComments() },
          { id: "d3", week: "7월 첫째 주", title: "기획자에게 데이터 리터러시는 필수일까?", prompt: "어디까지 알아야 충분한가에 대한 각자의 기준.", count: 15, active: false,
            body: ["SQL을 직접 짜야 할까요, 아니면 지표를 해석할 수 있으면 될까요?", "데이터 팀과의 협업 경험을 나눠주세요."],
            comments: baseComments() },
          { id: "d0", week: "6월 넷째 주", title: "온보딩, 어디까지 설계해야 할까?", prompt: "첫 사용 경험의 범위에 대한 이야기.", count: 8, active: false,
            body: ["온보딩을 너무 길게 만들면 이탈하고, 짧으면 헤맵니다.", "여러분의 기준은 무엇인가요?"],
            comments: baseComments() },
        ],
      },
      {
        id: "s2", name: "UX 리서치 스터디", desc: "사용자 인터뷰와 리서치 방법론 연구", members: 8, code: "UX9M3T", role: "멤버", week: "7월 셋째 주",
        memberList: [{ name: "박리서치", role: "UX Researcher" }, { name: "이관찰", role: "Designer" }, { name: "김기획", role: "PO" }],
        shares: [
          { id: 1, day: "tue", title: "질문 설계의 기술", source: "brunch.co.kr", url: "https://brunch.co.kr/@example/2", sharedBy: "박리서치", role: "UX Researcher", note: "유도 질문 피하는 법.", likes: 12, comments: 3 },
          { id: 2, day: "thu", title: "사용성 테스트 5명의 법칙", source: "nngroup.com", url: "https://www.nngroup.com/articles/example2/", sharedBy: "이관찰", role: "Designer", note: "왜 5명이면 충분한가.", likes: 8, comments: 1 },
        ],
        discussions: [
          { id: "d1", week: "7월 셋째 주", title: "인터뷰, 몇 명이면 충분할까?", prompt: "정성 조사의 적정 표본에 대해 이야기해요.", count: 6, active: true,
            body: ["5명이면 충분하다는 말, 정말 모든 경우에 맞을까요?", "제품 성격에 따라 다르다면, 그 기준은?"],
            comments: baseComments() },
        ],
      },
      {
        id: "s3", name: "신입 PM 북클럽", desc: "PM 필독서를 함께 읽는 모임", members: 22, code: "PM4W8R", role: "멤버", week: "7월 셋째 주",
        memberList: [{ name: "최회고", role: "Product Coach" }, { name: "김독서", role: "PM" }, { name: "한독자", role: "Junior PM" }],
        shares: [
          { id: 1, day: "wed", title: "인스파이어드 3장 정리", source: "velog.io", url: "https://velog.io/@example/inspired", sharedBy: "최회고", role: "Product Coach", note: "제품 발견 파트 핵심.", likes: 19, comments: 5 },
        ],
        discussions: [
          { id: "d1", week: "7월 셋째 주", title: "PM의 우선순위, 무엇으로 정하나?", prompt: "RICE, ICE, 아니면 감?", count: 11, active: true,
            body: ["프레임워크는 많은데, 실제로 무엇을 쓰시나요?", "결국 이해관계자 설득이 관건 아닐까요?"],
            comments: baseComments() },
        ],
      },
    ],
    recent: [
      { id: 1, studyId: "s1", type: "comment", text: "한독자님이 ‘숫자 없이도 설득되는 기획서’ 토론에 의견을 남겼어요", time: "10분 전" },
      { id: 2, studyId: "s1", type: "share", text: "이지표님이 화요일에 글을 공유했어요", time: "1시간 전" },
      { id: 3, studyId: "s2", type: "member", text: "이관찰님이 ‘UX 리서치 스터디’에 참여했어요", time: "어제" },
      { id: 4, studyId: "s3", type: "share", text: "최회고님이 수요일에 글을 공유했어요", time: "어제" },
    ],
  };
})();
