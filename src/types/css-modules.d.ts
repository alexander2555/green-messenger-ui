// Type declarations for CSS Modules
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.module.scss' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.module.sass' {
  const classes: Record<string, string>
  export default classes
}