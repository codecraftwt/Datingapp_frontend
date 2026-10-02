import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  messages: [],         // messages list for active chat thread
  allMessages: [],      // list of all messages across all conversations
  activeChatUser: null, // user object we are currently chatting with
  typingUsers: {},      // typing status: userId -> boolean
  loading: false,
  error: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setMessages: (state, action) => {
      const msgs = action.payload || [];
      state.messages = msgs;
      if (Array.isArray(msgs) && msgs.length > 0) {
        const msgsMap = new Map();
        msgs.forEach((m) => {
          const mId = (m._id || m.id)?.toString();
          if (mId) msgsMap.set(mId, m);
          if (m.tempId) msgsMap.set(m.tempId.toString(), m);
        });
        state.allMessages = (state.allMessages || []).map((m) => {
          const mId = (m._id || m.id)?.toString();
          const mTemp = m.tempId?.toString();
          const match = (mId && msgsMap.get(mId)) || (mTemp && msgsMap.get(mTemp));
          if (match) {
            return {
              ...m,
              ...match,
              isPinned: match.isPinned !== undefined ? match.isPinned : m.isPinned,
              reactions: Array.isArray(match.reactions) ? match.reactions : m.reactions,
              replyTo: match.replyTo || m.replyTo,
            };
          }
          return m;
        });
      }
    },
    setAllMessages: (state, action) => {
      const newMsgs = action.payload || [];
      // Keep any active thread optimistic isPinned or reactions
      if (Array.isArray(state.messages) && state.messages.length > 0) {
        const activePinned = state.messages.find((m) => m.isPinned);
        if (activePinned) {
          const pId = (activePinned._id || activePinned.id)?.toString();
          const pTemp = activePinned.tempId?.toString();
          state.allMessages = newMsgs.map((m) => {
            const mId = (m._id || m.id)?.toString();
            const mTemp = m.tempId?.toString();
            if ((pId && mId === pId) || (pTemp && (mTemp === pTemp || mId === pTemp))) {
              return { ...m, isPinned: true };
            }
            return m;
          });
          return;
        }
      }
      state.allMessages = newMsgs;
    },
    addMessage: (state, action) => {
      const msg = action.payload;
      if (!msg) return;
      const mId = msg._id || msg.id;
      const msgTempId = msg.tempId;

      const idxInMsgs = state.messages.findIndex(
        m => (m._id || m.id) === mId || (msgTempId && (m.tempId === msgTempId || (m._id || m.id) === msgTempId))
      );
      if (idxInMsgs === -1) {
        state.messages.push(msg);
      } else {
        state.messages[idxInMsgs] = { ...state.messages[idxInMsgs], ...msg };
      }

      const idxInAll = state.allMessages.findIndex(
        m => (m._id || m.id) === mId || (msgTempId && (m.tempId === msgTempId || (m._id || m.id) === msgTempId))
      );
      if (idxInAll === -1) {
        state.allMessages.push(msg);
      } else {
        state.allMessages[idxInAll] = { ...state.allMessages[idxInAll], ...msg };
      }
    },
    updateMessageStatus: (state, action) => {
      const { messageId, status } = action.payload;
      const index = state.messages.findIndex(msg => msg._id === messageId);
      if (index !== -1) {
        state.messages[index].status = status;
      }
    },
    editMessageInState: (state, action) => {
      const { messageId, text } = action.payload;
      const index = state.messages.findIndex(msg => msg._id === messageId);
      if (index !== -1) {
        state.messages[index].text = text;
        state.messages[index].isEdited = true;
      }
    },
    deleteMessageInState: (state, action) => {
      const messageId = action.payload;
      state.messages = state.messages.filter(msg => msg._id !== messageId);
    },
    setActiveChatUser: (state, action) => {
      state.activeChatUser = action.payload;
    },
    setTyping: (state, action) => {
      const { userId, isTyping } = action.payload;
      state.typingUsers[userId] = isTyping;
    },
    updateMessageReactions: (state, action) => {
      const { messageId, tempId, reactions } = action.payload;
      const targetIdStr = messageId?.toString();
      const targetTempStr = tempId?.toString();
      const updateList = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map((msg) => {
          const mIdStr = (msg.id || msg._id)?.toString();
          const mTempStr = msg.tempId?.toString();
          if (
            (targetIdStr && (mIdStr === targetIdStr || mTempStr === targetIdStr)) ||
            (targetTempStr && (mIdStr === targetTempStr || mTempStr === targetTempStr))
          ) {
            return { ...msg, reactions: Array.isArray(reactions) ? reactions : [] };
          }
          return msg;
        });
      };
      state.messages = updateList(state.messages);
      state.allMessages = updateList(state.allMessages);
    },
    updateMessagePinned: (state, action) => {
      const { messageId, tempId, isPinned } = action.payload;
      const targetIdStr = messageId?.toString();
      const targetTempStr = tempId?.toString();
      const updateList = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map((msg) => {
          const mIdStr = (msg.id || msg._id)?.toString();
          const mTempStr = msg.tempId?.toString();
          if (
            (targetIdStr && (mIdStr === targetIdStr || mTempStr === targetIdStr)) ||
            (targetTempStr && (mIdStr === targetTempStr || mTempStr === targetTempStr))
          ) {
            return { ...msg, isPinned: !!isPinned };
          }
          if (isPinned) {
            return { ...msg, isPinned: false };
          }
          return msg;
        });
      };
      state.messages = updateList(state.messages);
      state.allMessages = updateList(state.allMessages);
    },
    updateMessageStarred: (state, action) => {
      const { messageId, tempId, isStarred } = action.payload;
      const targetIdStr = messageId?.toString();
      const targetTempStr = tempId?.toString();
      const updateList = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map((msg) => {
          const mIdStr = (msg.id || msg._id)?.toString();
          const mTempStr = msg.tempId?.toString();
          if (
            (targetIdStr && (mIdStr === targetIdStr || mTempStr === targetIdStr)) ||
            (targetTempStr && (mIdStr === targetTempStr || mTempStr === targetTempStr))
          ) {
            return { ...msg, isStarred: !!isStarred };
          }
          return msg;
        });
      };
      state.messages = updateList(state.messages);
      state.allMessages = updateList(state.allMessages);
    },
    clearChat: (state) => {
      state.messages = [];
      state.activeChatUser = null;
      state.typingUsers = {};
      state.allMessages = [];
    },
  },
});

export const {
  setMessages,
  setAllMessages,
  addMessage,
  updateMessageStatus,
  editMessageInState,
  deleteMessageInState,
  setActiveChatUser,
  setTyping,
  updateMessageReactions,
  updateMessagePinned,
  updateMessageStarred,
  clearChat,
} = chatSlice.actions;

export default chatSlice.reducer;
