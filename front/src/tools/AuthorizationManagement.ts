const  addGetAuthorization = (accessString:string) => {
    return {
        headers: {
            Authorization: accessString? 'Bearer '+accessString : '',
            'X-Kwirth-App': 'true'
        }
    }
}

const  addDeleteAuthorization = (accessString:string) => {
    return {
        method:'DELETE',
        headers: {
            Authorization: accessString? 'Bearer '+accessString : '',
            'X-Kwirth-App': 'true'
        }
    }
}

const addPostAuthorization = (accessString:string, payload:string = '') => {
    return {
        method:'POST',
        body:payload,
        headers: {
            Authorization: accessString? 'Bearer '+accessString : '',
            'Content-Type':'application/json',
            'X-Kwirth-App': 'true'
        }
    }
}

const addPutAuthorization = (accessString:string, payload:string = '') => {
    return {
        method:'PUT',
        body:payload,
        headers: {
            Authorization: accessString? 'Bearer '+accessString : '',
            'Content-Type': 'application/json',
            'X-Kwirth-App': 'true'
        }
    }
}

export { addGetAuthorization, addPostAuthorization, addDeleteAuthorization, addPutAuthorization }