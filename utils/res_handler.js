module.exports = {
    /**
     * @param  {Object} res
     * @param  {String} message=null
     * @param  {Object} data=null
     */
    sendRes: (res, message = null, data = null, httpCode = 200) => {
        res.status(httpCode).send({
            success: true,
            message: message,
            data: data
        });
    },
    /**
     * @param  {Object} res
     * @param  {Number} errCode
     * @param  {String} message=null
     * @param  {String} data=null
     */
    sendError: (res, errCode = 400, message = null, data = null) => {
        // ErrorReport.create({ route, method, message: JSON.stringify(message), status: errCode, data: JSON.stringify(data)})
        res.status(errCode).send({
            success: false,
            message: message,
            data: data
        });
    }
};