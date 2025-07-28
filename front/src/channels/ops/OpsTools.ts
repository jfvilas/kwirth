function cleanANSI(text: string): string {
    const regexAnsi = /\x1b\[[0-9;]*[mKHVfJrcegH]|\x1b\[\d*n/g;
    return text.replace(regexAnsi, '') // replace all matches with empty strings
}

export { cleanANSI }