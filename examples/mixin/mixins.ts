import { User } from './model';

export class HumanMixin {
  sex: 'm' | 'f';

  sleep(time: number): Promise<void> {
    return Promise.resolve();
  }

  hunt(): Promise<number> {
    return Promise.resolve(1);
  }

  eat(): void {    
  }

  static find(name: string): any[] {
    return [];
  }

  static proCreate(male: HumanMixin, female: HumanMixin): any {
    return null;
  }
}

export interface HumanMixinStatic<T> {
  proCreate(male: HumanMixin, female: HumanMixin): T & HumanMixin;
  find(name: string): Array<T & HumanMixin>;
}

export class FullnameMixin {
  getFullName(this: User): string {
    return this.firstName + ' ' + this.lastName;
  }
}