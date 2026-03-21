-- Allow authenticated users to create organizations (onboarding)
CREATE POLICY "Authenticated can create organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to create memberships (onboarding self-assignment)
CREATE POLICY "Authenticated can create memberships"
  ON public.memberships FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow members to update their own membership (accept invite)
CREATE POLICY "Users can update own memberships"
  ON public.memberships FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Allow org members to update their organization settings
CREATE POLICY "Members can update their orgs"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (id IN (SELECT get_user_org_ids(auth.uid())));
