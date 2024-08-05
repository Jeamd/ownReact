import "./hooks/index";

function createElement(type, props, ...children) {
  console.log(type, props, children);
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  };
}

// 构建文本节点的虚拟对象
// 因为babel对于文本节点返回的就是个字符串，普通节点转化的是对creactElement方法的调用
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

function createDom(fiber) {
  const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);

  return dom;
}

const isEvent = (key) => key.startsWith("on");
const isProperty = (key) => key !== "children" && !isEvent(key);
const isNew = (prev, next) => (key) => prev[key] !== next[key];
const isGone = (prev, next) => (key) => !(key in next);
function updateDom(dom, prevProps, nextProps) {
  //Remove old or changed event listeners
  Object.keys(prevProps)
    // 处理事件事件过滤出来
    .filter(isEvent)
    // 把删除的事件 改变的事件过滤出来
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      // 开始删事件
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = "";
    });

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name];
    });

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

function commitRoot() {
  // 更新的时候才会有，先不看
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);

  // 更新到视图上去了 wipRoot变成了currentRoot 下次更新 重新创建 wipRoot
  currentRoot = wipRoot;
  wipRoot = null;
}

// 提交阶段了
function commitWork(fiber) {
  if (!fiber) {
    return;
  }

  let domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    // 找到该fiber节点上边第一个存在真实DOM节点的fiber节点，因为更新或者创建都得操作DOM
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

function render(element, container) {
  // work in progress root
  // 要更新的FiberRoot ?
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };

  deletions = [];
  // 下一个工作单元
  nextUnitOfWork = wipRoot;
}

//
let nextUnitOfWork = null;
// 当前的fiberRoot ?
let currentRoot = null;
// 要更新的FiberRoot ?
let wipRoot = null;
// 要删除的 fiber节点 数组 ?
let deletions = null;

// 调度器
function workLoop(deadline) {
  // 应该让路 就是看这一帧的剩余时间是否小于 1ms，小了就 别执行任务单元了
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    // 去进行 Fiber child节点的构建 返回 下一个要构建的fiber节点
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

  // 没有下一个工作单元时（fiber构建完毕后）再去提交
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  // 每层的子fiber构建完毕后向下判断

  if (fiber.child) {
    return fiber.child;
  }

  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
  // 找到最顶层后 就啥也没返回结束的 nextUnitOfWork 就会被清空
}

let wipFiber = null;
// 每次
let hookIndex = null;

function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  // 这个意思是 执行 函数组件的 fiber.type()时
  // 遇到的第一个 hook 就从 fiber.hooks: hook[] 第0项开始取
  // hook中都会存在一个 hokIndex ++ , 执行完这个 useXXX() hook，hookIndex 就已经加1了
  // 后续在遇到 其他 useXXX() 取得就是在这个fiber.alrtnet对应的hook备份
  hookIndex = 0;
  // 每次更新 把当前的 hook 队列清空
  wipFiber.hooks = [];
  // 执行函数组件，返回的children 是组件的 virtualDOM
  const children = [fiber.type(fiber.props)];
  // 去构建组件内的 子 Fiber
  reconcileChildren(fiber, children);
}

function useState(initial) {
  // wipFiber 组件 fiber 对象
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  // 这里是取得备份的 执行操作
  const actions = oldHook ? oldHook.queue : [];
  // 每次更新把这些动作执行一次 更新组件内状态
  actions.forEach((action) => {
    hook.state = action(hook.state);
  });

  const setState = (action) => {
    hook.queue.push(action);
    // 重新构建 根 Fiber 触发任务单元
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  // 把这个hook状态存到 组件的 fiber 节点中 顺序跟 调用 useXXX() 的顺序相同
  wipFiber.hooks.push(hook);

  hookIndex++;
  return [hook.state, setState];
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    // 在这构建fiber节点的 dom属性 （stateNode）
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props.children);
}

// 1.构建子 Fiber 节点
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  // currentFiber 的 第一个子节点， 初始渲染时 wipFiber.alternate = null
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  // 上一个 子节点
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]; // 虚拟dom
    let newFiber = null;

    // 查看跟备份的节点的类型是否相同
    const sameType = oldFiber && element && element.type == oldFiber.type;

    // 初始渲染不走这
    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }

    if (element && !sameType) {
      // 跟之前的Fiber 类型不同 或者 初始化时 进来
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null, // 现在叫 stateNode
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT", // 打上新增标记
      };
    }

    // 初始渲染不走这
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    // 初始渲染不走这
    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      // 这里绑定child指向
      wipFiber.child = newFiber;
    } else if (element) {
      // 这里绑定sibling指向
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

const Didact = {
  createElement,
  render,
  useState,
};

/** @jsx Didact.createElement */
function Counter() {
  const [state, setState] = Didact.useState(1);
  return (
    <h1
      onClick={() => {
        setState((state) => state + 1);
      }}
      style="user-select: none"
    >
      Count: {state}
    </h1>
  );
}
// virtualDOM
const element = <Counter />;
const container = document.getElementById("root");
Didact.render(element, container);
