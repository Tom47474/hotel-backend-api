// 成功
export function success(res, data) {
    return res.status(200).json({ code: 200, message: '成功', data });
}
// 失败（4xx）
export function fail(res, code, message) {
    return res.status(code).json({ code, message, data: null });
}