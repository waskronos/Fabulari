// Accept the same small image formats for profiles and chat messages.
export function isValidImage(value) {
    if (typeof value !== 'string') return false;
    if (!value) return true;
    const match = value.match(/^data:image\/(png|jpeg|gif);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return false;
    const image = Buffer.from(match[2], 'base64');
    if (image.length > 2 * 1024 * 1024) return false;
    return (match[1] === 'png' && image.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') ||
        (match[1] === 'jpeg' && image.subarray(0, 3).toString('hex') === 'ffd8ff') ||
        (match[1] === 'gif' && ['GIF87a', 'GIF89a'].includes(image.subarray(0, 6).toString()));
}
