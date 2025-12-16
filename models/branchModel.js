// 평행우주
const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema({
    day: Number,
    hour: Number,
    choiceType: String,
    oppositeChoice: String,
    oppositeCost: Number,
    oppositeDescription: String,
    oppositeSleepChangeMinutes: {
        type: Number,
        default: 0
    },
    oppositeStudyChangeMinutes: {
        type: Number,
        default: 0
    },
    oppositeFinanceChange: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Branch = mongoose.model("Branch", branchSchema);
module.exports = Branch;