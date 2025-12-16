import { client } from "./openaiClient.js";

export async function choiceForfreetime({ rawStats, weakestState }) {
    
    // weakestState에 따른 프롬프트 조정
    let stateGuidance;
    if (weakestState === 0) {
        stateGuidance = "모든 상태가 동일하므로, 다양한 두 가지 활동을 제시하라.";
    } else {
        stateGuidance = `가장 부족한 상태는 "${weakestState}"이다. 선택지 A는 "${weakestState}" 상태를 직접 회복하는 행동이어야 한다.`;
    }

    const prompt = `너는 대학생의 선택 갈림길을 설계하는 AI다.

[사용자 현재 상태]
- 학습 점수: ${rawStats?.grade || 0}점
- 수면 점수: ${rawStats?.sleep || 0}점
- 재정 점수: ${rawStats?.finance || 0}점

[현재 상황]
- 자유 시간입니다 (수업 없음)
- ${stateGuidance}

[선택지 생성 원칙]
1. 선택지는 반드시 2개만 만든다.
2. 선택지는 추상적인 태도가 아니라, 실제로 할 수 있는 "구체적인 행동"으로 작성한다.
3. 두 선택지는 "회복 행동" vs "회피/우회 행동"의 구조여야 한다.
4. 선택지 B도 다른 카테고리에 부분적 이득이 있는 합리적인 선택이어야 한다.
5. **중요: 아래 예시를 그대로 따라하지 말고, 창의적이고 다양한 선택지를 생성하라!**

[카테고리 정의 - 매우 중요!]
각 선택지는 반드시 아래 정의에 맞는 category를 배정해야 한다:

• study (학습):
  - 실제로 공부하거나 학습하는 행동만 해당
  - 시간은 언급하지 않고 행동만 언급
  - 참고 예시 (그대로 사용 금지): "과제를 한다", "전공 공부를 한다"
  - 주의: 강의 듣기, 재무 관리 공부 등은 study가 아님!

• sleep (수면):
  - 실제로 자거나 수면을 취하는 행동만 해당
  - 시간은 언급하지 않고 행동만 언급
  - 참고 예시 (그대로 사용 금지): "낮잠을 잔다"
  - 주의: 휴식, 쉬기, 카페 가기, 친구 만나기 등은 sleep이 아님!

• finance (재정):
  - 실제로 돈을 벌거나 지출하는 행동만 해당
  - 시간은 언급하지 않고 행동만 언급
  - 돈을 버는 참고 예시 (그대로 사용 금지): "알바를 한다", "과외를 한다"
  - 돈을 쓰는 참고 예시 (그대로 사용 금지): "카페에 간다", "쇼핑을 한다"
  - 주의: 재무 관리 공부, 아껴 쓰기 계획 등은 finance가 아님!

[창의성 가이드]
다음과 같이 다양하고 구체적인 선택지를 만들어라:

study 카테고리 창의적 예시:
- "도서관에서 수학 문제를 푼다"
- "스터디 카페에서 전공 책을 읽는다"
- "집에서 영어 단어를 외운다"
- "과제 보고서를 작성한다"
- "시험 공부를 한다"

sleep 카테고리 창의적 예시:
- "소파에서 눈을 붙인다"
- "침대에 누워 잔다"
- "강의실 뒷자리에서 조금 잔다"
- "기숙사 방에서 쉰다"

finance 카테고리 창의적 예시 (돈 벌기):
- "편의점에서 근무한다"
- "과외 학생을 가르친다"
- "배달 아르바이트를 한다"
- "주유소에서 일한다"
- "학교 행정실에서 근로장학생으로 일한다"

finance 카테고리 창의적 예시 (돈 쓰기):
- "친구들과 삼겹살을 먹으러 간다"
- "영화관에서 영화를 본다"
- "PC방에서 게임을 한다"
- "노래방에 간다"
- "온라인 쇼핑을 한다"
- "카페에서 음료를 마신다"

[잘못된 예시 - 이런 답변 금지]
❌ "열심히 한다", "노력한다", "계획을 세운다" (너무 추상적)
❌ "재무 관리 강의를 듣는다" (실제로 돈을 벌거나 쓰는 행동이 아님)
❌ "친구와 카페에서 이야기한다" → sleep 카테고리 (잘못된 카테고리)
❌ "집에서 쉬며 지출을 줄인다" (실제 행동이 아님)

[출력 형식]
반드시 아래 JSON 형식으로만 출력한다. 다른 설명이나 마크다운 없이 순수 JSON만 출력:

{
  "message": "현재 상황을 자연스럽게 설명하는 한두 문장",
  "choices": [
    { "label": "구체적인 행동 설명", "category": "study|sleep|finance" },
    { "label": "구체적인 행동 설명", "category": "study|sleep|finance" }
  ]
}`;

    try {
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.9, // 더 높은 창의성
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        
        // JSON 파싱 시도
        const parsed = JSON.parse(content);
        
        // 유효성 검증
        if (!parsed.message || !Array.isArray(parsed.choices) || parsed.choices.length !== 2) {
            throw new Error("Invalid response structure");
        }

        // category 유효성 검증
        const validCategories = ['study', 'sleep', 'finance'];
        parsed.choices = parsed.choices.map((choice, index) => {
            const category = choice.category;
            if (!validCategories.includes(category)) {
                console.warn(`Invalid category: ${category}, using fallback`);
                return {
                    ...choice,
                    category: index === 0 ? (weakestState || 'study') : 'finance'
                };
            }
            return choice;
        });

        return parsed;

    } catch (e) {
        console.error("AI 선택지 생성 실패:", e);
        
        // 폴백: weakestState에 따른 기본 선택지
        return generateFallbackChoices(weakestState);
    }
}

/**
 * AI 실패 시 기본 선택지 생성
 */
function generateFallbackChoices(weakestState) {
    const fallbacks = {
        study: {
            message: "학습 시간이 부족합니다. 공부를 할까요?",
            choices: [
                { label: "도서관에서 전공 공부를 한다", category: "study" },
                { label: "친구들과 PC방에 간다", category: "finance" }
            ]
        },
        sleep: {
            message: "피곤해 보입니다. 휴식이 필요할 것 같아요.",
            choices: [
                { label: "기숙사 방에서 잔다", category: "sleep" },
                { label: "카페에서 커피를 마시며 버틴다", category: "finance" }
            ]
        },
        finance: {
            message: "재정이 부족합니다. 돈을 벌까요?",
            choices: [
                { label: "편의점에서 근무한다", category: "finance" },
                { label: "도서관에서 공부한다", category: "study" }
            ]
        },
        balanced: {
            message: "여유로운 시간입니다. 무엇을 할까요?",
            choices: [
                { label: "도서관에서 가볍게 공부한다", category: "study" },
                { label: "침대에서 쉰다", category: "sleep" }
            ]
        }
    };

    // weakestState가 0이거나 null이면 balanced 사용
    if (weakestState === 0 || weakestState === null) {
        return fallbacks.balanced;
    }

    // weakestState에 해당하는 선택지 반환, 없으면 balanced
    return fallbacks[weakestState] || fallbacks.balanced;
}
