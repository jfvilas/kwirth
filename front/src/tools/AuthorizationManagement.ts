const  addGetAuthorization = (accessString:string) => {
    return {
        headers: {
            Authorization:accessString? 'Bearer '+accessString : '',
        }
    }
}

const  addDeleteAuthorization = (accessString:string) => {
    return {
        method:'DELETE',
        headers: {
            Authorization:accessString? 'Bearer '+accessString : '',
        }
    }
}

const addPostAuthorization = (accessString:string, payload:string = '') => {
    return {
        method:'POST',
        body:payload,
        headers: {
            Authorization:accessString? 'Bearer '+accessString : '',
            'Content-Type':'application/json',
        }
    }
}

const addPutAuthorization = (accessString:string, payload:string = '') => {
    return {
        method:'PUT',
        body:payload,
        headers: {
            Authorization:accessString? 'Bearer '+accessString : '',
            'Content-Type':'application/json',
        }
    }
}

export { addGetAuthorization, addPostAuthorization, addDeleteAuthorization, addPutAuthorization }