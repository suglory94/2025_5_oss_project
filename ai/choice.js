import { client } from "../ai/openaiClient.js";
import Stats from "../logic/state.js";

export async function choice({ period, hasClass, weakestState }) {
    const stats = await Stats();

    const prompt =
        `너는 대학생의 선택 갈림길을 설계하는 AI다.

[상황]
- 다음 교시: ${period}교시
- 수업 여부: ${hasClass ? "있음" : "없음"}

[사용자 상태]
- 학점: ${stats.grade}
- 수면: ${stats.sleep}
- 재정: ${stats.finance}

[선택지 생성 원칙]
- 선택지는 반드시 현재 사용자 상태와 "직접적으로 연결된 행동"이어야 한다.
- 선택지는 추상적인 태도가 아니라, 실제로 할 수 있는 구체적인 행동으로 작성한다.

[분기 규칙]
1. 선택지는 반드시 2개만 만든다.
2. 수업이 있는 경우:
   - 선택지는 반드시 "수업에 간다", "수업에 가지 않는다" 여야 한다.
3. 수업이 없는 경우:
   - 가장 부족한 상태는 "${weakestState}"이다.
   - 선택지 A는 해당 상태를 "직접 회복"하는 행동이어야 한다.
   - 선택지 B는 그 회복을 "미루거나 회피"하는 행동이어야 한다.
   - 단, 선택지 B도 다른 카테고리에 부분적인 이득이 있는 합리적인 선택이어야 한다.
4. 두 선택지는 단순한 반대 행동이 아니라,
   "회복 vs 회피(우회)" 관계여야 한다.
5. 선택지는 반드시 아래 JSON 형식으로만 출력한다.

{
  "message": "현재 상황을 자연스럽게 설명하는 한두 문장",
  "choices": [
    { "label": "구체적인 행동 설명", "category": "study|sleep|finance" },
    { "label": "구체적인 행동 설명", "category": "study|sleep|finance" }
  ]
}`;


    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
    });

    try {
        return JSON.parse(response.choices[0].message.content);
    } catch (e) {
        console.error("AI branch JSON 파싱 실패", e);
        return {
            message: "지금은 선택지를 생성할 수 없어요.",
            choices: []
        };
    }
}
