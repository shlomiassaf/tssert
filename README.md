**tssert** is a small type assertion library for typescript.

### Why?
Type assertion library for TypeScript? That's the whole point of TypeScript, isnt it?

Well, Yes.

TypeScript does type assertion by default when it performs compilation, this is the bread and butter of TypeScript:
```ts
const myStr: string = 15;
```
The code above will result in a design time error:
```
Type '15' is not assignable to type 'string'.
```

So, just by writing our code in TypeScript we get type assertion.

But, what if we want to test if an expression throws a semantic error?

The term "Type assertion" in **tssert** is a bit different from what it means in TypeScript.
**tssert** takes a different appraoch, it will check for specific things like explicit semantic errors or an explicit type.

### Where?
**tssert** can be used by library developers who uses mixin's and / or complex type manipulation using generics, unions and intersections.

The typescript team uses a similar tool to test their own compiler but instead of JSDoc annotation to describe output types they create a snapshot
of the types as baseline and compare.

TSLint also uses a similar approach but instead of JSDoc annotation they use special TS like file with markers where a TSLint error should occur.

I use **tssert** in some of the libraries I build, libraries that contain mixin's and user defined type insertion through plugins.
Through development I found that sometime the projected types resulted in `any` type, usually after TS version upgrades so I used error assertions.

### How
**tssser** uses a declerative syntax in JSDoc format to assert an expected outcome from the TS Compiler.

## Semantic error assertion
A semantic error is an error the TS compiler emits when it identifies syntax errors or type errors. We can tell **tssert** that we excpct an error from an expression:

```ts
 /**
 * @tssert
 * @tsError 2322
 * @loc 7
 */
const myStr: string = 15;
```
If we run the code in `tsc` we will get:
```
my-file.ts(6,7): error TS2322: Type '15' is not assignable to type 'string'.
```

Since we expect the compiler to throw a semantic error, number 2322 (TS2322) at charecter number 7, if we run in in `tssert` we will not get an error.

> Character position is always relative to the line it refers to starting from 1 (base 1)`.

We can also expect an exact match for the text message:
```ts
 /**
 * @tssert THIS IS AN OPTIONAL MESSAGE TO INCLUDE WITH THE ERROR
 * @tsError 2322
 * @tsErrorMsg Type '15' is not assignable to type 'string'.
 * @loc 7
 */
const myStr: string = 15;
```

The output:

![image](https://user-images.githubusercontent.com/5377501/33636276-251e6e20-da24-11e7-8a21-5943705bb8ad.png)

Now let's change `@tsError` to 9999 so it will fail:
![image](https://user-images.githubusercontent.com/5377501/33636311-4902d16e-da24-11e7-89f0-d06a5e51e1ed.png)

You can also use watch mode using `-w` or `--watch`:
![0dh99vwnwy](https://user-images.githubusercontent.com/5377501/33636574-6e0174e2-da25-11e7-988c-fca659ce8db2.gif)

> All options used in `tsc` are valid in **tssert**

we can define multiple assertions for the same expression:
```ts
/**
 * @tssert
 * @tsError 2322
 * @loc 7
 */
/**
 * @tssert
 * @tsError 2352
 * @loc 23
 */
const myStr: string = 15 as boolean;
```

we can define assertiong for multi-line expressions:
 ```ts
 /**
 * @tssert
 * @tsError 2322
 * @loc 3:11
 */
 const x: Promise<string> = Promise.resolve('str')
   .then( value => {
     const y: number = value;
     return value;
  });
 ```

 In this exapmle `@loc` does not define a character position but a line and character position separated by a column; (LINE:CHAR)

 The line count startes from the first expression after the JSDoc and not from the first line of the document. Like character position it is also using base 1.

## Type assertion
Type assertion are built in to TypeScript so in most cases you case assert without **tsssert**

If you want to, you can:
```ts
/**
 * @tssert
 * @tsType Promise<string>
 * @loc 16
 */
Promise.resolve('str')
  .then( value => {
    const y: string = value;
    return y;
  });
```
![q9lw1jivxk](https://user-images.githubusercontent.com/5377501/33637214-52048c22-da28-11e7-979b-6430ff63d40c.gif)

Note that the position must be set on an expression or identifier, some positions might not return a property type.

## Configuration:
Files written for **tssert** will throw errors in a `tsc` compilation so they must be in a dedicated folder.
A `tsconfig` file for **tssert** should identical to your `tsc` configration with 1 change, set the `include`
proeprty to include only the location where the test files for **tssert** are.

For example, if we put all files for **tssert** in `test/types` with the suffix `.type-spec.ts` the `include`
property should be `[ "test/types/**/*.type-spec.ts" ]`

