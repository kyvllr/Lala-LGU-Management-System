import React from 'react';

export default function OtherStep({ formData, loading,
  specialChange, addSpecial, removeSpecial,
  distinctionChange, addDistinction, removeDistinction,
  membershipChange, addMembership, removeMembership,
  references, handleReferenceChange, addReference, removeReference,
  handleChange, handleGovIdChange,
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">VIII. Other Information</h2>

      {/* Special Skills */}
      <div className="mb-4">
        <h3 className="font-medium text-gray-700 mb-2">Special Skills and Hobbies</h3>
        <div className="space-y-2">
          {formData.specialSkills.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={s}
                placeholder="Write in full"
                onChange={(e) => specialChange(i, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded"
                disabled={loading}
              />
              <button type="button" onClick={() => removeSpecial(i)} className="px-2 bg-red-100 text-red-700 rounded">✕</button>
            </div>
          ))}
          <button type="button" onClick={addSpecial} className="mt-2 bg-blue-100 text-blue-700 px-3 py-1 rounded">Add Skill/Hobby</button>
        </div>
      </div>

      {/* Distinctions */}
      <div className="mb-4">
        <h3 className="font-medium text-gray-700 mb-2">Non-Academic Distinctions / Recognition</h3>
        <div className="space-y-2">
          {formData.distinctions.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={d} onChange={(e) => distinctionChange(i, e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded" disabled={loading} placeholder="Write in full" />
              <button type="button" onClick={() => removeDistinction(i)} className="px-2 bg-red-100 text-red-700 rounded">✕</button>
            </div>
          ))}
          <button type="button" onClick={addDistinction} className="mt-2 bg-blue-100 text-blue-700 px-3 py-1 rounded">Add Distinction</button>
        </div>
      </div>

      {/* Memberships */}
      <div className="mb-4">
        <h3 className="font-medium text-gray-700 mb-2">Membership in Association / Organization</h3>
        <div className="space-y-2">
          {formData.memberships.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={m} onChange={(e) => membershipChange(i, e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded" disabled={loading} placeholder="Write in full" />
              <button type="button" onClick={() => removeMembership(i)} className="px-2 bg-red-100 text-red-700 rounded">✕</button>
            </div>
          ))}
          <button type="button" onClick={addMembership} className="mt-2 bg-blue-100 text-blue-700 px-3 py-1 rounded">Add Membership</button>
        </div>
      </div>

      {/* Related by consanguinity / affinity */}
      <div className="mb-4">
        <h3 className="font-medium text-gray-700 mb-2">Are you related by consanguinity or affinity to the appointing or recommending authority, or to the chief of bureau or office or to the person who has immediate supervision over you in the Office, Bureau or Department where you will be apppointed</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="mb-1">a. within the third degree?</p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" name="relatedThirdDegree" value="Y" checked={formData.relatedThirdDegree === 'Y'} onChange={handleChange} disabled={loading} /> Yes
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="relatedThirdDegree" value="N" checked={formData.relatedThirdDegree === 'N'} onChange={handleChange} disabled={loading} /> No
              </label>
            </div>
          </div>

          <div>
            <p className="mb-1">b. within the fourth degree? (for Local Government Unit - Career Employees)</p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" name="relatedFourthDegree" value="Y" checked={formData.relatedFourthDegree === 'Y'} onChange={handleChange} disabled={loading} /> Yes
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="relatedFourthDegree" value="N" checked={formData.relatedFourthDegree === 'N'} onChange={handleChange} disabled={loading} /> No
              </label>
            </div>
          </div>
        </div>

        <div className="mt-2">
          <label className="block text-sm text-gray-700">If yes, give details</label>
          <input
            type="text"
            name="relatedDetails"
            value={formData.relatedDetails}
            onChange={handleChange}
            disabled={loading || !(formData.relatedThirdDegree === 'Y' || formData.relatedFourthDegree === 'Y')}
            required={formData.relatedThirdDegree === 'Y' || formData.relatedFourthDegree === 'Y'}
            aria-required={formData.relatedThirdDegree === 'Y' || formData.relatedFourthDegree === 'Y'}
            className="w-full px-3 py-2 border border-gray-300 rounded mt-1"
            placeholder={formData.relatedThirdDegree === 'Y' || formData.relatedFourthDegree === 'Y' ? '' : 'Select Yes to enable input'}
          />
        </div>
      </div>

      {/* Other Declarations */}
      <div className="mb-4">
        <h3 className="font-medium text-gray-700 mb-2">Other Declarations</h3>

        {/* Administrative offense */}
        <div className="mb-4">
          <p className="mb-1">a. Have you ever been found guilty of any administrative offense?</p>
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="adminOffense" value="Y" checked={formData.adminOffense === 'Y'} onChange={handleChange} disabled={loading} /> Yes
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="adminOffense" value="N" checked={formData.adminOffense === 'N'} onChange={handleChange} disabled={loading} /> No
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-700">If yes, give details</label>
            <input type="text" name="adminOffenseDetails" value={formData.adminOffenseDetails} onChange={handleChange} disabled={loading || formData.adminOffense !== 'Y'} required={formData.adminOffense === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" placeholder={formData.adminOffense === 'Y' ? '' : 'Select Yes to enable input'} />
          </div>
        </div>

        {/* Criminal charge */}
        <div className="mb-4">
          <p className="mb-1">Have you been criminally charged before any court?</p>
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="criminalCharge" value="Y" checked={formData.criminalCharge === 'Y'} onChange={handleChange} disabled={loading} /> Yes
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="criminalCharge" value="N" checked={formData.criminalCharge === 'N'} onChange={handleChange} disabled={loading} /> No
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-700">If yes, give details</label>
              <input type="text" name="criminalChargeDetails" value={formData.criminalChargeDetails} onChange={handleChange} disabled={loading || formData.criminalCharge !== 'Y'} required={formData.criminalCharge === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" placeholder={formData.criminalCharge === 'Y' ? '' : 'Select Yes to enable input'} />
            </div>
            <div>
              <label className="block text-sm text-gray-700">Date Filed</label>
              <input type="date" name="criminalChargeDateFiled" value={formData.criminalChargeDateFiled || ''} onChange={handleChange} disabled={loading || formData.criminalCharge !== 'Y'} required={formData.criminalCharge === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
            </div>
            <div>
              <label className="block text-sm text-gray-700">Status of Case/s</label>
              <input type="text" name="criminalChargeStatus" value={formData.criminalChargeStatus} onChange={handleChange} disabled={loading || formData.criminalCharge !== 'Y'} required={formData.criminalCharge === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
            </div>
          </div>
        </div>

        {/* Convicted */}
        <div className="mb-4">
          <p className="mb-1">Have you ever been convicted of any crime or violation of any law, decree, ordinance or regulation by any court or tribunal?</p>
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="convicted" value="Y" checked={formData.convicted === 'Y'} onChange={handleChange} disabled={loading} /> Yes
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="convicted" value="N" checked={formData.convicted === 'N'} onChange={handleChange} disabled={loading} /> No
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-700">If yes, give details</label>
            <input type="text" name="convictedDetails" value={formData.convictedDetails} onChange={handleChange} disabled={loading || formData.convicted !== 'Y'} required={formData.convicted === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" placeholder={formData.convicted === 'Y' ? '' : 'Select Yes to enable input'} />
          </div>
        </div>

        {/* Separated from service */}
        <div className="mb-4">
          <p className="mb-1">Have you ever been separated from the service in any of the following modes: resignation, retirement, dropped from the rolls, dismissal, termination, end of term, finished contract or phased out (abolition) in the public or private sector?</p>
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="separated" value="Y" checked={formData.separated === 'Y'} onChange={handleChange} disabled={loading} /> Yes
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="separated" value="N" checked={formData.separated === 'N'} onChange={handleChange} disabled={loading} /> No
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-700">If yes, give details</label>
            <input type="text" name="separatedDetails" value={formData.separatedDetails} onChange={handleChange} disabled={loading || formData.separated !== 'Y'} required={formData.separated === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" placeholder={formData.separated === 'Y' ? '' : 'Select Yes to enable input'} />
          </div>
        </div>

        {/* Other short declarations (kept readOnly) */}
        <div className="space-y-2">
          <p style={{color: 'gray'}}>–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––</p>

          <div className="mb-3">
            <p className="mb-1">a. Have you ever been a candidate in a national or local election held within the last year (except Barangay election)?</p>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="candidate" value="Y" checked={formData.candidate === 'Y'} onChange={handleChange} disabled={loading} /> Yes
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="candidate" value="N" checked={formData.candidate === 'N'} onChange={handleChange} disabled={loading} /> No
              </label>
            </div>
            <div>
              <label className="block text-sm text-gray-700">If yes, give details</label>
              <input type="text" name="candidateDetails" value={formData.candidateDetails} onChange={handleChange} disabled={loading || formData.candidate !== 'Y'} required={formData.candidate === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" placeholder={formData.candidate === 'Y' ? '' : 'Select Yes to enable input'} />
            </div>
          </div>

          <div className="mb-3">
            <p className="mb-1">b. Have you resigned from the government service during the three (3)-month period before the last election to promote/actively campaign for a national or local candidate?</p>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="resignedToCampaign" value="Y" checked={formData.resignedToCampaign === 'Y'} onChange={handleChange} disabled={loading} /> Yes
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="resignedToCampaign" value="N" checked={formData.resignedToCampaign === 'N'} onChange={handleChange} disabled={loading} /> No
              </label>
            </div>
            <div>
              <label className="block text-sm text-gray-700">If yes, give details</label>
              <input type="text" name="resignedDetails" value={formData.resignedDetails} onChange={handleChange} disabled={loading || formData.resignedToCampaign !== 'Y'} required={formData.resignedToCampaign === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" placeholder={formData.resignedToCampaign === 'Y' ? '' : 'Select Yes to enable input'} />
            </div>
          </div>

          <p style={{color: 'gray'}}>–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––</p>
          <div>
            <p className="mb-1">Have you acquired the status of an immigrant or permanent resident of another country?</p>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="immigrant" value="Y" checked={formData.immigrant === 'Y'} onChange={handleChange} disabled={loading} /> Yes
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="immigrant" value="N" checked={formData.immigrant === 'N'} onChange={handleChange} disabled={loading} /> No
              </label>
            </div>
            <div>
              <label className="block text-sm text-gray-700">If YES, give details (country)</label>
              <input
                type="text"
                name="immigrantCountry"
                value={formData.immigrantCountry}
                onChange={handleChange}
                disabled={loading || formData.immigrant !== 'Y'}
                required={formData.immigrant === 'Y'}
                className="w-full px-3 py-2 border border-gray-300 rounded mt-1"
                placeholder={formData.immigrant === 'Y' ? '' : 'Select Yes to enable input'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Special Laws / IDs */}
      <div className="mb-4">
        <h3 className="font-medium text-gray-700 mb-2">Pursuant to: (a) Indigenous People's Act (RA 8371); (b) Magna Carta for Disabled Persons (RA 7277, as amended); and (c) Expanded Solo Parents Welfare Act (RA 11861), please answer the following items:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <p className="mb-1">a. Are you a member of any indigenous group?</p>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="indigenous" value="Y" checked={formData.indigenous === 'Y'} onChange={handleChange} disabled={loading} /> Yes
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="indigenous" value="N" checked={formData.indigenous === 'N'} onChange={handleChange} disabled={loading} /> No
              </label>
            </div>
            <div>
              <label className="block text-sm text-gray-700">If YES, please specify</label>
              <input type="text" name="indigenousDetails" value={formData.indigenousDetails} onChange={handleChange} disabled={loading || formData.indigenous !== 'Y'} required={formData.indigenous === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" placeholder={formData.indigenous === 'Y' ? '' : 'Select Yes to enable input'} />
            </div>
          </div>

          <div>
            <p className="mb-1">b. Are you a person with disability?</p>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="pwd" value="Y" checked={formData.pwd === 'Y'} onChange={handleChange} disabled={loading} /> Yes
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="pwd" value="N" checked={formData.pwd === 'N'} onChange={handleChange} disabled={loading} /> No
              </label>
            </div>
            <div>
              <label className="block text-sm text-gray-700">If YES, please specify ID no.</label>
              <input type="text" name="pwdId" value={formData.pwdId} onChange={handleChange} disabled={loading || formData.pwd !== 'Y'} required={formData.pwd === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" placeholder={formData.pwd === 'Y' ? '' : 'Select Yes to enable input'} />
            </div>
          </div>

          <div>
            <p className="mb-1">c. Are you a solo parent?</p>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="soloParent" value="Y" checked={formData.soloParent === 'Y'} onChange={handleChange} disabled={loading} /> Yes
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="soloParent" value="N" checked={formData.soloParent === 'N'} onChange={handleChange} disabled={loading} /> No
              </label>
            </div>
            <div>
              <label className="block text-sm text-gray-700">If YES, please specify ID no.</label>
              <input type="text" name="soloParentId" value={formData.soloParentId} onChange={handleChange} disabled={loading || formData.soloParent !== 'Y'} required={formData.soloParent === 'Y'} className="w-full px-3 py-2 border border-gray-300 rounded mt-1" placeholder={formData.soloParent === 'Y' ? '' : 'Select Yes to enable input'} />
            </div>
          </div>
        </div>
      </div>

          <br />
      {/* References */}
      <div className="mb-4">
        <h3 className="font-medium text-gray-700 mb-2">References (Person not related by consanguinity or affinity to applicant /appointee)</h3>
        <div className="space-y-2">
          {references.map((r, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <div className="md:col-span-4"><input type="text" placeholder="Name" value={r.name} onChange={(e) => handleReferenceChange(i, 'name', e.target.value)} className="w-full px-3 py-2 border rounded" disabled={loading} /></div>
              <div className="md:col-span-5"><input type="text" placeholder="Office / Residential Address" value={r.address} onChange={(e) => handleReferenceChange(i, 'address', e.target.value)} className="w-full px-3 py-2 border rounded" disabled={loading} /></div>
              <div className="md:col-span-2 flex gap-2"><input type="text" placeholder="Contact No. / Email" value={r.contact} onChange={(e) => handleReferenceChange(i, 'contact', e.target.value)} className="flex-1 px-3 py-2 border rounded" disabled={loading} /><button type="button" onClick={() => removeReference(i)} className="px-2 bg-red-100 text-red-700 rounded">✕</button></div>
            </div>
          ))}
          <button type="button" onClick={addReference} className="mt-2 bg-blue-100 text-blue-700 px-3 py-1 rounded">Add Reference</button>
        </div>
      </div>
<br/>
      {/* Declaration */}
      <div className="mb-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="declaration"
            checked={!!formData.declaration}
            onChange={(e) => handleChange({ target: { name: 'declaration', value: e.target.checked } })}
            disabled={loading}
            required
          />
          <span>
            I declare under oath that I have personally accomplished this Personal Data Sheet which is a true, correct, and complete statement pursuant to the provisions of pertinent laws, rules, and regulations of the Republic of the Philippines. I authorize the agency head/authorized representative to verify/validate the contents stated herein. I agree that any misrepresentation made in this document and its attachments shall cause the filing of administrative/criminal case/s against me.
          </span>
        </label>
      </div>
<br/>
      {/* Government Issued ID */}
      <div className="mb-4">
        <h3 className="font-medium text-gray-700 mb-2">Government Issued ID</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" value={formData.govId.type} onChange={(e) => handleGovIdChange('type', e.target.value)} className="px-3 py-2 border rounded" placeholder="Government Issued ID" disabled={loading} />
          <input type="text" value={formData.govId.number} onChange={(e) => handleGovIdChange('number', e.target.value)} className="px-3 py-2 border rounded" placeholder="ID / License / Passport No." disabled={loading} />
          <input type="text" value={formData.govId.datePlace} onChange={(e) => handleGovIdChange('datePlace', e.target.value)} className="px-3 py-2 border rounded" placeholder="Date / Place of Issuance" disabled={loading} />
        </div>
      </div>
    </div>
  );
}
