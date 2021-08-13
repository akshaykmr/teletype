export class ClientError extends Error {}

export class Unauthorized extends ClientError {}

export class BadRequest extends ClientError {}
