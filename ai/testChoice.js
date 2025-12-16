import { choiceForfreetime } from "./choiceByai.js";

const test = async () => {
    const rawStats = {
        grade: 45,
        sleep: 80,
        finance: 30
    };

    const weakestState = "finance";

    const result = await choiceForfreetime({ rawStats, weakestState });

    console.log("=== AI 응답 결과 ===");
    console.log(JSON.stringify(result, null, 2));
};

test();
