import axios from "axios";
import { client } from "./openaiClient.js";


// 백엔드에서 현재 학점/수면/재정 상태 가져오기
async function Stats() {
  try {
    const response = await axios.get("http://localhost:3000/api/stats"); // *backend
    // *backend _ 백엔드에서 각 카테고리의 변수명 확인하고 수정해야함
    return {
      grade: response.data.grade,
      sleep: response.data.sleep,
      finance: response.data.finance
    };
  } catch (error) {
    console.error("백엔드로부터 '학점, 수면, 재정' 조회 실패:", error);
    return {
      grade: null,
      sleep: null,
      finance: null
    };
  }
}

// 조언 멘트 
// *choices 변수도 다시 한 번 확인할 것
// -> 현재 코드는 choices 속성에 label이랑 category가 있는 것으로 구현해놨음
export async function Advice(choices) {  
  const stats = await Stats();

  //프롬프트 생성
  // label : 선택지 문구
  const prompt = `
너는 대학생의 하루 의사결정을 돕는 조언 AI이다.
각 선택지는 특정 카테고리(학점/수면/재정)에 직접적인 영향을 준다.

[사용자 상태]
- 학점: ${stats.grade}
- 수면: ${stats.sleep}
- 재정: ${stats.finance}

[선택지 정보]
1) ${choices[0].label} 
   - 영향 카테고리: ${choices[0].category}

2) ${choices[1].label}
   - 영향 카테고리: ${choices[1].category}

[작성 규칙]
- 두 선택지 중 어떤 선택이 지금 상태에서 더 이로운지 판단하라.
- 반드시 "왜 그런지" 상태 점수를 기준으로 설명하라.
- A 선택지를 추천하면  
  "A는 너의 ${choices[0].category} 점수가 현재 ${stats[choices[0].category]}로 낮기 때문에 도움이 됩니다."  
  이런 식으로 구체적 근거를 들어라.
- 추천하지 않은 선택지도  
  "반면 B는 ${choices[1].category} 점수가 ${stats[choices[1].category]}라 비교적 여유 있는 상태입니다."  
 처럼 비교 근거를 덧붙여라.
- 문장은 2~3문장으로 간단하고 자연스럽게 작성하라.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "너는 대학생에게 조언하는 친절한 assistant이다." },
      { role: "user", content: prompt }
    ]
  });

  const advice = response.choices[0].message.content.trim();

  return {
    advice,
    stats
  };
}
