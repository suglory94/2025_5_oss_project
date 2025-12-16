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
   - 좋은 예: "도서관에 가서 2시간 공부한다", "편의점 알바를 한다", "30분 낮잠을 잔다"
   - 나쁜 예: "열심히 한다", "노력한다", "계획을 세운다"
3. 두 선택지는 "회복 행동" vs "회피/우회 행동"의 구조여야 한다.
4. 선택지 B도 다른 카테고리에 부분적 이득이 있는 합리적인 선택이어야 한다.
5. 각 선택지에 적절한 category를 붙인다 (study, sleep, finance 중 하나).

[출력 형식]
반드시 아래 JSON 형식으로만 출력한다. 다른 설명이나 마크다운 없이 순수 JSON만 출력:

{
  "message": "현재 상황을 자연스럽게 설명하는 한두 문장",
  "choices": [
    { "label": "구체적인 행동 설명", "category": "study" },
    { "label": "구체적인 행동 설명", "category": "sleep" }
  ]
}`;

    try {
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7, // 창의성과 일관성의 균형
            response_format: { type: "json_object" } // JSON 모드 활성화
        });

        const content = response.choices[0].message.content;
        
        // JSON 파싱 시도
        const parsed = JSON.parse(content);
        
        // 유효성 검증
        if (!parsed.message || !Array.isArray(parsed.choices) || parsed.choices.length !== 2) {
            throw new Error("Invalid response structure");
        }

        // category 기본값 설정 (없을 경우)
        parsed.choices = parsed.choices.map((choice, index) => ({
            ...choice,
            category: choice.category || (index === 0 ? weakestState || 'study' : 'sleep')
        }));

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
                { label: "도서관에 가서 공부한다", category: "study" },
                { label: "친구들과 카페에서 쉰다", category: "sleep" }
            ]
        },
        sleep: {
            message: "피곤해 보입니다. 휴식이 필요할 것 같아요.",
            choices: [
                { label: "30분 낮잠을 잔다", category: "sleep" },
                { label: "에너지 드링크를 마시고 공부한다", category: "study" }
            ]
        },
        finance: {
            message: "재정이 부족합니다. 돈을 벌까요?",
            choices: [
                { label: "편의점 알바를 한다 (2시간)", category: "finance" },
                { label: "집에서 공부하며 지출을 줄인다", category: "study" }
            ]
        },
        balanced: {
            message: "여유로운 시간입니다. 무엇을 할까요?",
            choices: [
                { label: "도서관에서 가볍게 공부한다", category: "study" },
                { label: "운동을 하며 기분 전환한다", category: "sleep" }
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

