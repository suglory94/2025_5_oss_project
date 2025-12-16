// 평행우주
const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema({
    day: Number,
    hour: Number,
    choiceType: String,
    oppositeChoice: String,
    oppositeCost: Number,
    oppositeDescription: String,
    oppositeFinanceChange: { // 실제 재정 변화량
        type: Number,
        default: 0
    },
    oppositeSleepChangeMinutes: { // 수면 시간 변화량 (분)
        type: Number,
        default: 0
    },
    oppositeStudyChangeMinutes: { // 학습 시간 변화량 (분)
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Branch = mongoose.model("Branch", branchSchema);
module.exports = Branch;