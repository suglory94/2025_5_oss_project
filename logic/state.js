// 백엔드에서 현재 학점/수면/재정 상태 가져오기
async function Stats() {
    try {
        const response = await axios.get("http://localhost:3000/api/hourly/raw-stats"); // *backend
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