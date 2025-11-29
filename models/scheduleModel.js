// 시간표 모델
const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
    start: { type: String, required: true },
    end: { type: String, required: true },
    subject: { type: String, required: true }
}, { _id: false });

const scheduleSchema = new mongoose.Schema({
    monday: [classSchema],
    tuesday: [classSchema],
    wednesday: [classSchema],
    thursday: [classSchema],
    friday: [classSchema],
    saturday: [classSchema],
    sunday: [classSchema]
}, {
    timestamps: true
});

const Schedule = mongoose.model("Schedule", scheduleSchema);
module.exports = Schedule;