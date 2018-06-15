export default config => store => next => async action => {
    if (!action.request) return next(action)

    const request = {
        url: (action.request.baseUrl || config.baseUrl) + action.request.url,
        queryParams: { ...config.queryParams, ...action.request.queryParams },
        headers: { 'Content-Type': 'application/json', ...config.headers, ...action.request.headers },
        body: JSON.stringify(action.request.body),
        method: action.request.method || 'GET',
        mode: config.mode || action.request.mode || 'cors'
    }

    if (config.onRequest) Object.assign(request, config.onRequest(action, request, store.getState))

    notify({ name: 'REQUEST', data: request }, config.log, { store, next, action })

    const query = Object.keys(request.queryParams).length ? `?${queryString(request.queryParams)}` : ''

    try {
        const resp = await doFetch(request.url + query, request)
        var result = { name: 'RESPONSE', data: resp }
    } catch (err) {
        var result = { name: 'ERROR', data: err }
    }

    notify(result, config.log, { store, next, action })
}

export const queryString = obj => Object.entries(obj)
    .map(([key, val]) => encodeURIComponent(key) + '=' + encodeURIComponent(val))
    .join('&')

export async function doFetch(url, opts) {
    const resp = await fetch(url, opts)
    let body = await resp.text()
    try { body = JSON.parse(body) } catch (e) { }
    const headers = {}
    for (var [key, val] of resp.headers) { headers[key] = val }
    const { ok, status } = resp
    return { ok, status, headers, body }
}

function notify({ name, data }, log, { action, store, next }) {
    if (log) log(name, data)
    const funName = "on" + name.charAt(0) + name.slice(1).toLowerCase()
    const callbackFun = action[funName]
    if (callbackFun instanceof Function) {
        const res = callbackFun(data, store.dispatch, store.getState)
        if (res) next(res)
    }
    if (action.resultAction) {
        const res = {
            type: `${action.resultAction}_${name}`,
            [name.toLowerCase()]: data
        }
        next(res)
    }
}
