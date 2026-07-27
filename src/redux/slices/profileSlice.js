import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  profileDetails: null, // current user's profile details
  otherProfiles: [],    // list of other users' profile questionnaires
  likes: [],            // list of users who liked the current user
  matches: [],          // list of mutual matches
  swipedIds: [],        // array of user IDs already swiped (liked)
  onlineUsers: [],      // list of online users
  loading: false,
  error: null,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    setProfileDetails: (state, action) => {
      state.profileDetails = action.payload;
    },
    setOtherProfiles: (state, action) => {
      state.otherProfiles = action.payload;
    },
    setLikes: (state, action) => {
      state.likes = action.payload;
    },
    setMatches: (state, action) => {
      state.matches = action.payload;
    },
    setSwipedIds: (state, action) => {
      state.swipedIds = action.payload;
    },
    setOnlineUsers: (state, action) => {
      state.onlineUsers = action.payload;
    },
    clearProfile: (state) => {
      state.profileDetails = null;
      state.otherProfiles = [];
      state.likes = [];
      state.matches = [];
      state.swipedIds = [];
      state.onlineUsers = [];
    },
  },
});

export const {
  setProfileDetails,
  setOtherProfiles,
  setLikes,
  setMatches,
  setSwipedIds,
  setOnlineUsers,
  clearProfile,
} = profileSlice.actions;

export default profileSlice.reducer;
