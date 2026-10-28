import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  messages: [],         // messages list for active chat thread
  allMessages: [],      // list of all messages across all conversations
  activeChatUser: null, // user object we are currently chatting with
  typingUsers: {},      // typing status: userId -> boolean
  loading: false,
  error: null,
};

const extractIdStr = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'object') {
    const id = val._id || val.id || val.userId;
    if (id) return id.toString();
  }
  return null;
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setMessages: (state, action) => {
      const rawMsgs = action.payload || [];
      const activePartnerId = extractIdStr(state.activeChatUser);

      // Only include messages belonging to the active partner if activeChatUser is set
      const msgs = activePartnerId
        ? rawMsgs.filter((m) => {
            if (!m) return false;
            if (m.id === 'match-init') return true;
            const rId = extractIdStr(m.receiverId) || extractIdStr(m.receiver);
            const sId = extractIdStr(m.senderId) || extractIdStr(m.sender);
            return (rId && rId === activePartnerId) || (sId && sId === activePartnerId);
          })
        : (action.payload === null ? [] : rawMsgs);

      const deletedIds = new Set();
      (state.messages || []).forEach((m) => {
        if (m.isDeletedForEveryone || m.text === 'This message was deleted') {
          if (m._id) deletedIds.add(m._id.toString());
          if (m.id) deletedIds.add(m.id.toString());
          if (m.tempId) deletedIds.add(m.tempId.toString());
        }
      });
      (state.allMessages || []).forEach((m) => {
        if (m.isDeletedForEveryone || m.text === 'This message was deleted') {
          if (m._id) deletedIds.add(m._id.toString());
          if (m.id) deletedIds.add(m.id.toString());
          if (m.tempId) deletedIds.add(m.tempId.toString());
        }
      });

      state.messages = msgs.map((m) => {
        const mId = (m._id || m.id)?.toString();
        const mTemp = m.tempId?.toString();
        const isDel = Boolean(
          m.isDeletedForEveryone ||
          m.text === 'This message was deleted' ||
          (mId && deletedIds.has(mId)) ||
          (mTemp && deletedIds.has(mTemp))
        );
        if (isDel) {
          return {
            ...m,
            isDeletedForEveryone: true,
            text: 'This message was deleted',
            mediaUrl: null,
            fileName: null,
            fileSize: null,
            reactions: [],
            isPinned: false,
          };
        }
        return m;
      });

      if (Array.isArray(state.messages) && state.messages.length > 0) {
        const msgsMap = new Map();
        state.messages.forEach((m) => {
          const mId = (m._id || m.id)?.toString();
          if (mId) msgsMap.set(mId, m);
          if (m.tempId) msgsMap.set(m.tempId.toString(), m);
        });
        state.allMessages = (state.allMessages || []).map((m) => {
          const mId = (m._id || m.id)?.toString();
          const mTemp = m.tempId?.toString();
          const match = (mId && msgsMap.get(mId)) || (mTemp && msgsMap.get(mTemp));
          if (match) {
            const isDel = Boolean(m.isDeletedForEveryone || match.isDeletedForEveryone);
            return {
              ...m,
              ...match,
              isDeletedForEveryone: isDel,
              text: isDel ? 'This message was deleted' : (match.text || m.text),
              mediaUrl: isDel ? null : (match.mediaUrl || m.mediaUrl),
              fileName: isDel ? null : (match.fileName || m.fileName),
              fileSize: isDel ? null : (match.fileSize || m.fileSize),
              isPinned: isDel ? false : (match.isPinned !== undefined ? match.isPinned : m.isPinned),
              reactions: isDel ? [] : (Array.isArray(match.reactions) ? match.reactions : m.reactions),
              replyTo: isDel ? null : (match.replyTo || m.replyTo),
            };
          }
          return m;
        });
      }
    },
    setAllMessages: (state, action) => {
      const newMsgs = action.payload || [];
      const deletedIds = new Set();
      (state.messages || []).forEach((m) => {
        if (m.isDeletedForEveryone || m.text === 'This message was deleted') {
          if (m._id) deletedIds.add(m._id.toString());
          if (m.id) deletedIds.add(m.id.toString());
          if (m.tempId) deletedIds.add(m.tempId.toString());
        }
      });
      (state.allMessages || []).forEach((m) => {
        if (m.isDeletedForEveryone || m.text === 'This message was deleted') {
          if (m._id) deletedIds.add(m._id.toString());
          if (m.id) deletedIds.add(m.id.toString());
          if (m.tempId) deletedIds.add(m.tempId.toString());
        }
      });

      const activeMap = new Map();
      if (Array.isArray(state.messages) && state.messages.length > 0) {
        state.messages.forEach((m) => {
          const mId = (m._id || m.id)?.toString();
          if (mId) activeMap.set(mId, m);
          if (m.tempId) activeMap.set(m.tempId.toString(), m);
        });
      }

      const mappedNewMsgs = newMsgs.map((m) => {
        const mId = (m._id || m.id)?.toString();
        const mTemp = m.tempId?.toString();
        const match = (mId && activeMap.get(mId)) || (mTemp && activeMap.get(mTemp));
        const isDel = Boolean(
          m.isDeletedForEveryone ||
          m.text === 'This message was deleted' ||
          (match && match.isDeletedForEveryone) ||
          (mId && deletedIds.has(mId)) ||
          (mTemp && deletedIds.has(mTemp))
        );
        if (isDel) {
          return {
            ...m,
            isDeletedForEveryone: true,
            text: 'This message was deleted',
            mediaUrl: null,
            fileName: null,
            fileSize: null,
            isPinned: false,
            reactions: [],
          };
        }
        if (match) {
          return {
            ...m,
            isPinned: match.isPinned !== undefined ? match.isPinned : m.isPinned,
            reactions: Array.isArray(match.reactions) ? match.reactions : m.reactions,
          };
        }
        return m;
      });

      // Preserve recent or pending messages that were added locally or via socket but not yet in newMsgs
      const newMsgIds = new Set();
      mappedNewMsgs.forEach((m) => {
        if (m._id) newMsgIds.add(m._id.toString());
        if (m.id) newMsgIds.add(m.id.toString());
        if (m.tempId) newMsgIds.add(m.tempId.toString());
      });

      const missingRecent = (state.allMessages || []).filter((oldM) => {
        if (!oldM) return false;
        const oId = (oldM._id || oldM.id)?.toString();
        const oTemp = oldM.tempId?.toString();
        if (oId && newMsgIds.has(oId)) return false;
        if (oTemp && newMsgIds.has(oTemp)) return false;
        const ageMs = Date.now() - new Date(oldM.createdAt || Date.now()).getTime();
        return ageMs < 120000 || !!oTemp;
      });

      state.allMessages = [...mappedNewMsgs, ...missingRecent];
    },
    addMessage: (state, action) => {
      const msg = action.payload;
      if (!msg) return;
      const mId = msg._id || msg.id;
      const msgTempId = msg.tempId;

      // Only add to active thread state.messages if this message belongs to the activeChatUser
      const activePartnerId = extractIdStr(state.activeChatUser);
      const rId = extractIdStr(msg.receiverId) || extractIdStr(msg.receiver);
      const sId = extractIdStr(msg.senderId) || extractIdStr(msg.sender);

      if (activePartnerId && ((rId && rId === activePartnerId) || (sId && sId === activePartnerId))) {
        const idxInMsgs = state.messages.findIndex(
          m => (m._id || m.id) === mId || (msgTempId && (m.tempId === msgTempId || (m._id || m.id) === msgTempId))
        );
        if (idxInMsgs === -1) {
          state.messages.push(msg);
        } else {
          state.messages[idxInMsgs] = { ...state.messages[idxInMsgs], ...msg };
        }
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
      const targetIdStr = messageId?.toString();
      if (!targetIdStr) return;
      const updateList = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map((msg) => {
          const mIdStr = (msg.id || msg._id)?.toString();
          const mTempStr = msg.tempId?.toString();
          if (mIdStr === targetIdStr || mTempStr === targetIdStr) {
            return { ...msg, status: status || 'seen' };
          }
          return msg;
        });
      };
      state.messages = updateList(state.messages);
      state.allMessages = updateList(state.allMessages);
    },
    markPartnerMessagesSeen: (state, action) => {
      const { partnerId, currentUserId } = action.payload || {};
      const pIdStr = partnerId?.toString();
      const cIdStr = currentUserId?.toString();
      if (!pIdStr) return;

      if (Array.isArray(state.messages)) {
        state.messages.forEach((m) => {
          if (!m) return;
          const sId = (m.senderId?._id || m.senderId || m.sender)?.toString();
          if (sId === pIdStr || m.sender === 'them') {
            m.status = 'seen';
          }
        });
      }

      if (Array.isArray(state.allMessages)) {
        state.allMessages.forEach((m) => {
          if (!m) return;
          const sId = (m.senderId?._id || m.senderId || m.sender)?.toString();
          const rId = (m.receiverId?._id || m.receiverId || m.receiver)?.toString();
          const isFromPartner = sId === pIdStr || (!sId && m.sender === 'them');
          const isForMe = !cIdStr || rId === cIdStr || (!rId && m.sender === 'them');
          if (isFromPartner && isForMe) {
            m.status = 'seen';
          }
        });
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
      const targetIdStr = action.payload?.toString();
      if (!targetIdStr) return;
      const filterList = (list) => {
        if (!Array.isArray(list)) return [];
        return list.filter((msg) => {
          const mIdStr = (msg.id || msg._id)?.toString();
          const mTempStr = msg.tempId?.toString();
          return mIdStr !== targetIdStr && mTempStr !== targetIdStr;
        });
      };
      state.messages = filterList(state.messages);
      state.allMessages = filterList(state.allMessages);
    },
    deleteForEveryoneInState: (state, action) => {
      const targetIdStr = action.payload?.toString();
      if (!targetIdStr) return;
      const updateList = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map((msg) => {
          const mIdStr = (msg.id || msg._id)?.toString();
          const mTempStr = msg.tempId?.toString();
          if (mIdStr === targetIdStr || mTempStr === targetIdStr) {
            return {
              ...msg,
              text: 'This message was deleted',
              mediaUrl: null,
              fileName: null,
              fileSize: null,
              reactions: [],
              isDeletedForEveryone: true,
            };
          }
          return msg;
        });
      };
      state.messages = updateList(state.messages);
      state.allMessages = updateList(state.allMessages);
    },
    deleteForMeInState: (state, action) => {
      const targetIdStr = action.payload?.toString();
      if (!targetIdStr) return;
      const filterList = (list) => {
        if (!Array.isArray(list)) return [];
        return list.filter((msg) => {
          const mIdStr = (msg.id || msg._id)?.toString();
          const mTempStr = msg.tempId?.toString();
          return mIdStr !== targetIdStr && mTempStr !== targetIdStr;
        });
      };
      state.messages = filterList(state.messages);
      state.allMessages = filterList(state.allMessages);
    },
    setActiveChatUser: (state, action) => {
      state.activeChatUser = action.payload;
      const partnerId = extractIdStr(action.payload);
      if (!partnerId) {
        state.messages = [];
      } else {
        // Hydrate state.messages exclusively with messages belonging to this partner
        state.messages = (state.allMessages || []).filter((m) => {
          if (!m) return false;
          if (m.id === 'match-init') return true;
          const rId = extractIdStr(m.receiverId) || extractIdStr(m.receiver);
          const sId = extractIdStr(m.senderId) || extractIdStr(m.sender);
          return (rId && rId === partnerId) || (sId && sId === partnerId);
        });
      }
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
      const { messageId, tempId, isStarred, currentUserId, starredBy, mediaUrl, messageType, fileName, fileSize } = action.payload || {};
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
            let nextStarredBy = Array.isArray(starredBy)
              ? [...starredBy]
              : (Array.isArray(msg.starredBy) ? [...msg.starredBy] : []);
            if (currentUserId && !Array.isArray(starredBy)) {
              const cIdStr = currentUserId.toString();
              if (isStarred) {
                if (!nextStarredBy.some(id => (id?._id || id)?.toString() === cIdStr)) {
                  nextStarredBy.push(cIdStr);
                }
              } else {
                nextStarredBy = nextStarredBy.filter(id => (id?._id || id)?.toString() !== cIdStr);
              }
            }
            const finalMediaUrl = msg.mediaUrl || mediaUrl || null;
            const finalMessageType = (msg.messageType && msg.messageType !== 'text')
              ? msg.messageType
              : (messageType || msg.messageType || (finalMediaUrl ? 'image' : 'text'));
            return {
              ...msg,
              isStarred: !!isStarred,
              starredBy: nextStarredBy,
              mediaUrl: finalMediaUrl,
              messageType: finalMessageType,
              fileName: msg.fileName || fileName || null,
              fileSize: msg.fileSize || fileSize || null,
            };
          }
          return msg;
        });
      };
      state.messages = updateList(state.messages);
      state.allMessages = updateList(state.allMessages);
    },
    clearChat: (state, action) => {
      const targetPartnerId = (action.payload?.id || action.payload?._id || action.payload)?.toString();
      if (targetPartnerId) {
        state.messages = [];
        state.allMessages = (state.allMessages || []).filter((m) => {
          const rId = (m.receiverId?._id || m.receiverId || m.receiver)?.toString();
          const sId = (m.senderId?._id || m.senderId || m.sender)?.toString();
          return rId !== targetPartnerId && sId !== targetPartnerId;
        });
      } else {
        state.messages = [];
        state.activeChatUser = null;
        state.typingUsers = {};
        state.allMessages = [];
      }
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
  deleteForEveryoneInState,
  deleteForMeInState,
  setActiveChatUser,
  setTyping,
  updateMessageReactions,
  updateMessagePinned,
  updateMessageStarred,
  markPartnerMessagesSeen,
  clearChat,
} = chatSlice.actions;

export default chatSlice.reducer;
