let isMount = true;
// 正在处理的 hook 的指针
let workInprogressHooks = null;

// 模拟组件的 fiber 对象
const fiber = {
  stateNode: HookCounter,

  // 保存hook对象，链表, 指向第一个hook
  memoizedState: null,
};

// 调度更新
function schedule() {
  // 每次调度更新时候要把workInprogressHooks指针重新指向第一个hook
  workInprogressHooks = fiber.memoizedState;
  // 每次调度更新 都会重新指向 组件的函数
  const app = fiber.stateNode();
  window.app = app;
  isMount = false;
}

// 定义usestate函数
const useState = (initialState) => {
  let hook;

  // 区分是否是首次渲染
  if (isMount) {
    hook = {
      // 这里是当前 hook 对应的值
      memoizedState: initialState,
      next: null,
      queue: {
        pending: null, // 指向最后一个 Update 对象
      },
    };

    // 添加到 fiber 对象上
    if (!fiber.memoizedState) {
      fiber.memoizedState = hook;
    } else {
      // 这个组件不止一处调用了 useState 那么就会走到这里
      // 构建链表结构
      workInprogressHooks.next = hook;
    }
    // 绑定正在处理的hook的指针
    workInprogressHooks = hook;
  } else {
    // 取mount时构建的对应 hook 对象, 每次调度这个fiber时会把workInprogressHooks指向 fiber 的 memoizedState
    hook = workInprogressHooks;
    // 执行下一个 hook 时保证指针正确
    workInprogressHooks = workInprogressHooks.next;
  }

  // 计算最新的 state
  let baseState = hook.memoizedState;

  // 存在需要更新的动作 update 对象
  if (hook.queue.pending) {
    let firstUpdate = hook.queue.pending.next;

    do {
      baseState = firstUpdate.action(baseState);
      firstUpdate = firstUpdate.next;
    } while (firstUpdate !== hook.queue.pending.next);

    // 执行完清空 queue.pending 指向
    hook.queue.pending = null;
  }

  hook.memoizedState = baseState;

  return [baseState, dispatchAction.bind(null, hook.queue)];
};

// useState 返回的 第二个 参数 就是 setState 方法
// 推送更新函数到 hook 对象中去
function dispatchAction(queue, action) {
  const update = {
    action,
    next: null,
  };

  // 第一次调用 setState 方法
  // 下边这一坨用来 构建update环形链表 queue.pending 指向环的最后一个 update 对象
  if (queue.pending === null) {
    update.next = update;
  } else {
    queue.pending.next = update;
    update.next = queue.pending.next;
  }

  queue.pending = update;

  // dispatch 要去触发更新
  schedule();
}

function HookCounter() {
  const [state, setState] = useState(1);
  console.log(state);

  return {
    onClick() {
      setState((num) => num + 1);
    },
  };
}

schedule();

export default HookCounter;
