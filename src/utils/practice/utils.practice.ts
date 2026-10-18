/* eslint-disable @typescript-eslint/no-unsafe-return */


export const sortOrder = [
  (r: any) => r.wpm.desc(),
  (r: any) => r.accuracy.desc(),
  (r: any) => r.timeTaken.asc(),
  (r: any) => r.createdAt.asc(),
  (r: any) => r.id.asc(),
];