"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNow = getNow;
exports.getMinAllowedDateTime = getMinAllowedDateTime;
exports.isDateTimeValid = isDateTimeValid;
exports.combineDateAndTime = combineDateAndTime;
const BUFFER_MINUTES = {
    reservation: 30,
    visitor: 15,
};
function getNow() {
    return new Date();
}
function getMinAllowedDateTime(type, now = getNow()) {
    const minDateTime = new Date(now);
    minDateTime.setMinutes(minDateTime.getMinutes() + BUFFER_MINUTES[type]);
    return minDateTime;
}
function isDateTimeValid(selectedDateTime, type, now = getNow()) {
    return selectedDateTime.getTime() >= getMinAllowedDateTime(type, now).getTime();
}
function combineDateAndTime(dateValue, timeValue) {
    const normalizedDate = dateValue?.trim();
    const normalizedTime = timeValue?.trim();
    if (!normalizedDate || !normalizedTime) {
        return null;
    }
    if (normalizedTime.includes("T")) {
        const parsedDateTime = new Date(normalizedTime);
        if (!Number.isNaN(parsedDateTime.getTime())) {
            return parsedDateTime;
        }
    }
    const hhmm = normalizedTime.length >= 5 ? normalizedTime.slice(0, 5) : normalizedTime;
    const parsedDateTime = new Date(`${normalizedDate}T${hhmm}:00`);
    if (Number.isNaN(parsedDateTime.getTime())) {
        return null;
    }
    return parsedDateTime;
}
