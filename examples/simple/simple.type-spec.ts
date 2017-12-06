 /**
 * @tssert THIS IS AN OPTIONAL MESSAGE TO INCLUDE WITH THE ERROR
 * @tsError 2322
 * @loc 7
 */
const myStr: string = 15;

 /**
 * @tssert
 * @tsError 2322
 * @tsErrorMsg Type '15' is not assignable to type 'string'.
 * @loc 7
 */
const myStr2: string = 15;

/**
 * @tssert
 * @tsError 2322
 * @loc 7
 */
/**
 * @tssert
 * @tsError 2352
 * @loc 24
 */
const myStr3: string = 15 as boolean;

 /**
 * @tssert
 * @tsError 2322
 * @loc 3:9
 */
const x: Promise<string> = Promise.resolve('str')
.then( value => {
  const y: number = value;
  return value;
});

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

interface MyType<T> { promiseOfT(): Promise<T>; }
declare function myTypeFactory<T>(): MyType<T>;

/**
 * @tssert
 * @tsType MyType<string>
 * @loc 10
 */
/**
 * @tssert
 * @tsType Promise<string>
 * @loc 25
 */
myTypeFactory<string>().promiseOfT();
