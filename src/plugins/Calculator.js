class Calculator {
  constructor() {
    // 插件集
    this.plugins = [];
  }
  /**
   * 插件化设计主要涉及
   * 插件底座
   * 插件注册方法
   * 调用该对应的插件
   */

  // 插件注册方法
  use(plugin) {
    this.plugins.push(plugin);
    this[plugin.name] = plugin.fn;
  }
}

const AddPlugin = {
  name: "add",
  fn: (a, b) => a + b,
};

// 初始化底座实例
const calculator = new Calculator();
calculator.use(AddPlugin);

console.log(calculator.add(1, 2));
