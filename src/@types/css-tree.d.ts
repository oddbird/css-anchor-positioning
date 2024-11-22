declare module 'css-tree/walker' {
  import { walk } from 'css-tree';

  export default walk;
}

declare module 'css-tree/utils' {
  export { clone, List } from 'css-tree';
}

declare module 'css-tree/generator' {
  import { generate } from 'css-tree';

  export default generate;
}

declare module 'css-tree/parser' {
  import { parse } from 'css-tree';

  export default parse;
}
