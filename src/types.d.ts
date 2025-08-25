declare module 'express' {
  export function Router(...args: any[]): any;
  export type Request = any;
  export type Response = any;
  export type NextFunction = any;
  const exp: any;
  export default exp;
}

declare module 'cors' {
  const fn: any;
  export default fn;
}

declare module 'supertest' {
  const fn: any;
  export default fn;
}
