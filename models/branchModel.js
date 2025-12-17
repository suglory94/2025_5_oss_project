// 평행우주 (사용자별 분리)
const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    day: Number,
    hour: Number,
    choiceType: String,
    oppositeChoice: String,
    oppositeCost: Number,
    oppositeDescription: String,
    oppositeFinanceChange: {
        type: Number,
        default: 0
    },
    oppositeSleepChangeMinutes: {
        type: Number,
        default: 0
    },
    oppositeStudyChangeMinutes: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// 복합 인덱스
branchSchema.index({ userId: 1, day: 1, hour: 1 });

const Branch = mongoose.model("Branch", branchSchema);
module.exports = Branch;