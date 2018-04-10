module.exports = (cachedUsers, fetchedUsers) => {
  const formattedFetchedUsers = fetchedUsers.map(user => ({instagramId: user.id.toString(), username: user._params.username, isActive: true}));
  const formattedCachedUsers = cachedUsers.map(user => ({instagramId: user.instagramId.toString(), username: user.username, isActive: true}));

  const updatedUsers = formattedFetchedUsers.reduce((accumulator, fetchedUser) => {
    const cachedUser = formattedCachedUsers.find((c) => c.instagramId === fetchedUser.instagramId);
    if (!cachedUser) {
      fetchedUser["isActive"] = true
      accumulator.push(fetchedUser);
    } else if (cachedUser) {
      if (cachedUser.username !== fetchedUser.username) {
        fetchedUser["isActive"] = true
        accumulator.push(fetchedUser);
      }
    }
    return accumulator;
  }, []);

  const inactiveUsers = formattedCachedUsers.filter((c) => !formattedFetchedUsers.find((f) => {c.instagramId === f.instagramId}));
  inactiveUsers.forEach(inactiveUser => inactiveUser["isActive"] = false);

  updatedUsers.concat(inactiveUsers);
  return updatedUsers;
};
